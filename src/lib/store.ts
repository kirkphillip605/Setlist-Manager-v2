import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { storageAdapter } from '@/lib/storageAdapter';
import { Song, Setlist, Gig, Set as SetType, SetSong, Profile } from '@/types';
import { getCurrentGlobalVersion } from '@/lib/api';
import { RealtimeChannel } from '@supabase/supabase-js';
import { queryClient } from '@/lib/queryClient';

// Constants
const DB_KEY = 'setlist-pro-v1';
const PERSISTED_TABLES = ['profiles', 'songs', 'gigs', 'setlists', 'sets', 'set_songs'];

// Types
interface DataState {
  profiles: Record<string, Profile>;
  songs: Record<string, Song>;
  gigs: Record<string, Gig>;
  setlists: Record<string, Setlist>;
  sets: Record<string, SetType>;
  set_songs: Record<string, SetSong>;
}

interface AppState extends DataState {
  lastSyncedVersion: number;
  lastSyncedAt: string | null;
  isInitialized: boolean;
  isLoading: boolean;
  isSyncing: boolean;
  isOnline: boolean;
  loadingMessage: string;
  loadingProgress: number;
  subscription: RealtimeChannel | null;

  // Actions
  initialize: () => Promise<void>;
  syncDeltas: () => Promise<void>;
  processRealtimeUpdate: (payload: any) => Promise<void>;
  reset: () => Promise<void>;
  setOnlineStatus: (status: boolean) => void;
}

// Initial Empty State
const initialDataState: DataState = {
  profiles: {},
  songs: {},
  gigs: {},
  setlists: {},
  sets: {},
  set_songs: {},
};

export const useStore = create<AppState>((set, get) => ({
  ...initialDataState,
  lastSyncedVersion: 0,
  lastSyncedAt: null,
  isInitialized: false,
  isLoading: true,
  isSyncing: false,
  isOnline: navigator.onLine,
  loadingMessage: 'Initializing...',
  loadingProgress: 0,
  subscription: null,

  setOnlineStatus: (status) => set({ isOnline: status }),

  initialize: async () => {
    // Prevent double init and subscription
    if (get().isInitialized) return;

    try {
      set({ isLoading: true, loadingMessage: 'Loading local data...' });

      // 1. Setup Realtime Subscription (Singleton)
      if (!get().subscription) {
        console.log("[Store] Setting up Realtime Subscription");
        const channel = supabase.channel('global_store_sync')
          .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
            // A. Handle Store Data (Optimistic + Gap Check)
            get().processRealtimeUpdate(payload);

            // B. Handle Non-Persisted Data (React Query)
            if (payload.table === 'gig_skipped_songs') {
                queryClient.invalidateQueries({ queryKey: ['skipped_songs_all'] });
            }
          })
          .subscribe((status) => {
             if (status === 'SUBSCRIBED') {
                 console.log("[Store] Connected to Realtime Changes");
             }
          });
        
        set({ subscription: channel });
      }

      // 2. Load from Local Storage
      const cachedString = await storageAdapter.getItem(DB_KEY);
      let hasData = false;

      if (cachedString) {
        try {
          const cached = JSON.parse(cachedString);
          set({
            ...cached.data,
            lastSyncedVersion: cached.lastSyncedVersion || 0,
            lastSyncedAt: cached.lastSyncedAt,
          });
          hasData = true;
        } catch (e) {
          console.error("Failed to parse cached data", e);
        }
      }

      // 3. Unblock UI Immediately if we have data (Optimistic Load)
      if (hasData) {
          set({ isInitialized: true, isLoading: false });
      }

      // 4. Trigger Background Sync if online
      if (get().isOnline) {
        get().syncDeltas().then(() => {
            if (!get().isInitialized) {
                set({ isInitialized: true, isLoading: false });
            }
        });
      } else {
          set({ isInitialized: true, isLoading: false });
      }

    } catch (error) {
      console.error("Initialization failed:", error);
      set({ 
        isLoading: false, 
        isInitialized: true, 
        loadingMessage: 'Offline Mode' 
      });
    }
  },

  syncDeltas: async () => {
    if (!get().isOnline || get().isSyncing) return;

    set({ isSyncing: true });

    try {
        const currentVersion = get().lastSyncedVersion;
        const globalVersion = await getCurrentGlobalVersion();
        
        // Smart Check
        if (currentVersion > 0 && currentVersion >= globalVersion) {
            set({ isSyncing: false });
            return;
        }

        let maxVersionFound = currentVersion;
        const newState: DataState = {
            profiles: { ...get().profiles },
            songs: { ...get().songs },
            gigs: { ...get().gigs },
            setlists: { ...get().setlists },
            sets: { ...get().sets },
            set_songs: { ...get().set_songs },
        };

        if (get().isLoading) set({ loadingMessage: 'Syncing changes...' });

        let progressStep = 0;
        const totalSteps = PERSISTED_TABLES.length;

        for (const table of PERSISTED_TABLES) {
            if (get().isLoading) {
                progressStep++;
                set({ loadingProgress: Math.round((progressStep / totalSteps) * 100) });
            }

            const { data, error } = await supabase
            .from(table)
            .select('*')
            .gt('version', currentVersion)
            .order('version', { ascending: true });

            if (error) {
                console.error(`Error syncing ${table}:`, error);
                continue; 
            }

            if (data && data.length > 0) {
                data.forEach((row: any) => {
                    // @ts-ignore
                    newState[table][row.id] = row;
                    if (row.version > maxVersionFound) {
                        maxVersionFound = row.version;
                    }
                });
            }
        }

        if (maxVersionFound > currentVersion) {
            const timestamp = new Date().toISOString();
            set({
                ...newState,
                lastSyncedVersion: maxVersionFound,
                lastSyncedAt: timestamp
            });
            await storageAdapter.setItem(DB_KEY, JSON.stringify({
                data: newState,
                lastSyncedVersion: maxVersionFound,
                lastSyncedAt: timestamp
            }));
            console.log(`[Sync] Updated to version ${maxVersionFound}`);
        }

    } catch (err) {
      console.error("Sync failed", err);
    } finally {
      set({ isSyncing: false, loadingMessage: '', loadingProgress: 100 });
    }
  },

  processRealtimeUpdate: async (payload: any) => {
    try {
        const { table, eventType, new: newRecord, old: oldRecord } = payload;
        
        if (!PERSISTED_TABLES.includes(table)) return;

        const state = get();
        
        // Gap Detection
        if (newRecord && newRecord.version > state.lastSyncedVersion + 1) {
            console.log(`[Realtime] Gap detected. Triggering Delta Sync.`);
            get().syncDeltas();
            return;
        }

        // @ts-ignore
        const currentTableMap = state[table];
        const newTableMap = { ...currentTableMap };
        let updatedVersion = state.lastSyncedVersion;

        if (eventType === 'DELETE') {
            delete newTableMap[oldRecord.id];
        } else if (newRecord) {
            const existing = newTableMap[newRecord.id] || {};
            newTableMap[newRecord.id] = { ...existing, ...newRecord };
            
            if (newRecord.version > updatedVersion) {
                updatedVersion = newRecord.version;
            }
        }

        // Optimistic Update
        set({ 
            [table as keyof DataState]: newTableMap,
            lastSyncedVersion: updatedVersion,
            // We update timestamp immediately for UI feedback
            lastSyncedAt: new Date().toISOString()
        });

        // Trigger verification sync (non-blocking)
        get().syncDeltas();

        // Persist
        const stateToSave = {
            data: {
                profiles: table === 'profiles' ? newTableMap : state.profiles,
                songs: table === 'songs' ? newTableMap : state.songs,
                gigs: table === 'gigs' ? newTableMap : state.gigs,
                setlists: table === 'setlists' ? newTableMap : state.setlists,
                sets: table === 'sets' ? newTableMap : state.sets,
                set_songs: table === 'set_songs' ? newTableMap : state.set_songs,
            },
            lastSyncedVersion: updatedVersion,
            lastSyncedAt: new Date().toISOString()
        };
        await storageAdapter.setItem(DB_KEY, JSON.stringify(stateToSave));

    } catch (e) {
        console.error("Error processing realtime update:", e);
        get().syncDeltas();
    }
  },

  reset: async () => {
    console.log("[Store] Resetting store and clearing subscription");
    const sub = get().subscription;
    if (sub) {
        supabase.removeChannel(sub);
    }
    await storageAdapter.removeItem(DB_KEY);
    set({ 
        ...initialDataState, 
        lastSyncedVersion: 0, 
        isInitialized: false, 
        isLoading: true,
        subscription: null 
    });
  }
}));