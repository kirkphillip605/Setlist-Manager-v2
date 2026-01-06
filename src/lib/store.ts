import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { storageAdapter } from '@/lib/storageAdapter';
import { Song, Setlist, Gig, Set as SetType, SetSong, Profile } from '@/types';
import { getCurrentGlobalVersion } from '@/lib/api';

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
  isLoading: true, // Only true during initial boot
  isSyncing: false, // True during background syncs
  isOnline: navigator.onLine,
  loadingMessage: 'Initializing...',
  loadingProgress: 0,

  setOnlineStatus: (status) => set({ isOnline: status }),

  initialize: async () => {
    // Prevent double init
    if (get().isInitialized) return;

    try {
      set({ isLoading: true, loadingMessage: 'Loading local data...' });

      // 1. Load from Local Storage
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

      // 2. Unblock UI Immediately if we have data (Optimistic Load)
      if (hasData) {
          set({ isInitialized: true, isLoading: false });
      }

      // 3. Trigger Background Sync if online
      if (get().isOnline) {
        // This runs in background, updating store as it goes
        get().syncDeltas().then(() => {
            // Ensure we mark initialized if we weren't already (e.g. fresh install)
            if (!get().isInitialized) {
                set({ isInitialized: true, isLoading: false });
            }
        });
      } else {
          // Offline and no data? Or offline and data loaded?
          set({ isInitialized: true, isLoading: false });
      }

    } catch (error) {
      console.error("Initialization failed:", error);
      set({ 
        isLoading: false, 
        isInitialized: true, // Allow render even if failed
        loadingMessage: 'Offline Mode' 
      });
    }
  },

  syncDeltas: async () => {
    if (!get().isOnline) return;
    if (get().isSyncing) return; // Prevent overlap

    set({ isSyncing: true });

    try {
        const currentVersion = get().lastSyncedVersion;
        
        // 1. Smart Check: Compare versions before fetching
        const globalVersion = await getCurrentGlobalVersion();
        
        if (currentVersion > 0 && currentVersion >= globalVersion) {
            // Local is up to date
            set({ isSyncing: false });
            return;
        }

        let maxVersionFound = currentVersion;
        // Shallow clone state for mutation
        const newState: DataState = {
            profiles: { ...get().profiles },
            songs: { ...get().songs },
            gigs: { ...get().gigs },
            setlists: { ...get().setlists },
            sets: { ...get().sets },
            set_songs: { ...get().set_songs },
        };

        // Only show message if we are in the "Blocking" phase (fresh install)
        if (get().isLoading) {
            set({ loadingMessage: 'Syncing changes...' });
        }

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

        // 3. Persist & Update State
        if (maxVersionFound > currentVersion) {
            const timestamp = new Date().toISOString();
            
            // Update Store
            set({
                ...newState,
                lastSyncedVersion: maxVersionFound,
                lastSyncedAt: timestamp
            });
            
            // Persist to Disk
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
    const { table, eventType, new: newRecord, old: oldRecord } = payload;
    
    if (!PERSISTED_TABLES.includes(table)) return;

    const state = get();
    // Gap Detection handled by syncDeltas trigger below, but we can do optimistic update first.

    // @ts-ignore
    const currentTableMap = state[table];
    const newTableMap = { ...currentTableMap };
    let updatedVersion = state.lastSyncedVersion;

    if (eventType === 'DELETE') {
      // Hard delete (fallback)
      delete newTableMap[oldRecord.id];
    } else if (newRecord) {
      // INSERT or UPDATE
      // CRITICAL: Merge with existing record to avoid partial update data loss
      // Supabase realtime payloads might not include all columns depending on config,
      // but usually include changed columns. Merging is safer.
      const existing = newTableMap[newRecord.id] || {};
      newTableMap[newRecord.id] = { ...existing, ...newRecord };
      
      if (newRecord.version > updatedVersion) {
        updatedVersion = newRecord.version;
      }
    }

    // Optimistic UI Update
    set({ 
      [table as keyof DataState]: newTableMap,
      // We don't update lastSyncedVersion here to allow syncDeltas to confirm validity
      // effectively, or we can update it if we trust the gap check.
      // Let's update it to keep UI responsive.
      lastSyncedVersion: updatedVersion
    });

    // Trigger Delta Sync to ensure consistency and fill any gaps
    // This is the "Check version / sync" logic requested.
    // It's non-blocking and will verify we have the absolute latest state.
    get().syncDeltas();

    // Persist to Disk
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
  },

  reset: async () => {
    console.log("[Store] Clearing local data");
    await storageAdapter.removeItem(DB_KEY);
    set({ ...initialDataState, lastSyncedVersion: 0, isInitialized: false, isLoading: true });
  }
}));