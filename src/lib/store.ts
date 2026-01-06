import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { storageAdapter } from '@/lib/storageAdapter';
import { Song, Setlist, Gig, Set as SetType, SetSong, Profile } from '@/types';

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
  isLoading: true,
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
      if (cachedString) {
        try {
          const cached = JSON.parse(cachedString);
          set({
            ...cached.data,
            lastSyncedVersion: cached.lastSyncedVersion || 0,
            lastSyncedAt: cached.lastSyncedAt,
          });
        } catch (e) {
          console.error("Failed to parse cached data", e);
        }
      }

      // 2. Sync Deltas if online
      if (get().isOnline) {
        await get().syncDeltas();
      }

      set({ isInitialized: true, isLoading: false });

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

    const currentVersion = get().lastSyncedVersion;
    let maxVersionFound = currentVersion;
    const newState: DataState = {
      profiles: { ...get().profiles },
      songs: { ...get().songs },
      gigs: { ...get().gigs },
      setlists: { ...get().setlists },
      sets: { ...get().sets },
      set_songs: { ...get().set_songs },
    };

    let progressStep = 0;
    const totalSteps = PERSISTED_TABLES.length;

    try {
      set({ loadingMessage: 'Syncing changes...' });

      for (const table of PERSISTED_TABLES) {
        // Update progress
        progressStep++;
        set({ loadingProgress: Math.round((progressStep / totalSteps) * 100) });

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
          // console.log(`[Sync] ${table}: ${data.length} updates`);
          
          data.forEach((row: any) => {
            // Apply Update
            // @ts-ignore - Dynamic access
            newState[table][row.id] = row;
            if (row.version > maxVersionFound) {
              maxVersionFound = row.version;
            }
          });
        }
      }

      // 3. Persist
      if (maxVersionFound > currentVersion) {
        set({
          ...newState,
          lastSyncedVersion: maxVersionFound,
          lastSyncedAt: new Date().toISOString()
        });
        
        await storageAdapter.setItem(DB_KEY, JSON.stringify({
          data: newState,
          lastSyncedVersion: maxVersionFound,
          lastSyncedAt: new Date().toISOString()
        }));
        
        console.log(`[Sync] Updated to version ${maxVersionFound}`);
      }

    } catch (err) {
      console.error("Sync failed", err);
    } finally {
      set({ loadingMessage: '', loadingProgress: 100 });
    }
  },

  processRealtimeUpdate: async (payload: any) => {
    const { table, eventType, new: newRecord, old: oldRecord } = payload;
    
    if (!PERSISTED_TABLES.includes(table)) return;

    const state = get();
    // @ts-ignore
    const currentTableMap = state[table];
    const newTableMap = { ...currentTableMap };
    let updatedVersion = state.lastSyncedVersion;

    if (eventType === 'DELETE') {
      // Hard delete (shouldn't happen with current arch, but good safety)
      delete newTableMap[oldRecord.id];
    } else if (newRecord) {
      // INSERT or UPDATE (includes soft deletes where deleted_at is set)
      newTableMap[newRecord.id] = newRecord;
      if (newRecord.version > updatedVersion) {
        updatedVersion = newRecord.version;
      }
    }

    // Update state
    set({ 
      [table as keyof DataState]: newTableMap, 
      lastSyncedVersion: updatedVersion 
    });

    // Debounced persist could go here, but for now we write on update to be safe
    // We only construct the payload for storage
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
    await storageAdapter.removeItem(DB_KEY);
    set({ ...initialDataState, lastSyncedVersion: 0, isInitialized: false });
  }
}));