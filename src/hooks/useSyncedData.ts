import { useStore } from "@/lib/store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useCallback } from "react";
import { getAllSkippedSongs } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

// --- Sync Coordination ---

export const useSyncManager = () => {
  const initialize = useStore(state => state.initialize);
  const syncDeltas = useStore(state => state.syncDeltas);
  const processRealtimeUpdate = useStore(state => state.processRealtimeUpdate);
  const setOnlineStatus = useStore(state => state.setOnlineStatus);
  const { user } = useAuth();
  
  const queryClient = useQueryClient();

  // Setup Listeners
  useEffect(() => {
    // 1. Online/Offline
    const handleOnline = () => {
        setOnlineStatus(true);
        syncDeltas();
    };
    const handleOffline = () => setOnlineStatus(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 2. Visibility
    const handleVisibility = () => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
            syncDeltas();
        }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // 3. Polling Fallback (5 min)
    const interval = setInterval(() => {
        if (navigator.onLine && document.visibilityState === 'visible') {
            syncDeltas();
        }
    }, 5 * 60 * 1000);

    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        document.removeEventListener("visibilitychange", handleVisibility);
        clearInterval(interval);
    };
  }, [syncDeltas, setOnlineStatus]);

  // 4. Realtime Subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('global_sync_v3')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
          console.log("Realtime change detected:", payload.table);
          
          // Process cached tables via store
          processRealtimeUpdate(payload);

          // Handle non-cached tables via React Query Invalidation
          if (['gig_skipped_songs'].includes(payload.table)) {
              queryClient.invalidateQueries({ queryKey: ['skipped_songs_all'] });
          }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, processRealtimeUpdate, queryClient]);

  return { runDeltaSync: syncDeltas, initialize };
};

// --- DATA HOOKS (Store Selectors) ---

// Helper to filter deleted items
const activeFilter = (item: any) => !item.deleted_at;

export const useSyncedSongs = () => {
  const songsMap = useStore(state => state.songs);
  const data = useMemo(() => Object.values(songsMap).filter(activeFilter).sort((a,b) => a.title.localeCompare(b.title)), [songsMap]);
  return { data, isLoading: false }; // Store is always "loaded" after init
};

export const useSyncedGigs = () => {
  const gigsMap = useStore(state => state.gigs);
  const setlistsMap = useStore(state => state.setlists); // For joining name
  
  const data = useMemo(() => {
      return Object.values(gigsMap)
        .filter(activeFilter)
        .map(gig => ({
            ...gig,
            setlist: gig.setlist_id ? setlistsMap[gig.setlist_id] : undefined
        }))
        .sort((a,b) => a.start_time.localeCompare(b.start_time));
  }, [gigsMap, setlistsMap]);

  return { data, isLoading: false };
};

// Complex Selector: Reconstruct Setlist Tree
export const useSyncedSetlists = () => {
  const setlistsMap = useStore(state => state.setlists);
  const setsMap = useStore(state => state.sets);
  const setSongsMap = useStore(state => state.set_songs);
  const songsMap = useStore(state => state.songs);

  const data = useMemo(() => {
    const rawSetlists = Object.values(setlistsMap).filter(activeFilter);
    
    return rawSetlists.map(list => {
        // Find sets for this list
        // Cast to 'any' to access raw DB properties that might not match domain types perfectly yet
        const listSets = Object.values(setsMap)
            .filter((s: any) => s.setlist_id === list.id && !s.deleted_at)
            .sort((a, b) => a.position - b.position);

        const hydratedSets = listSets.map(set => {
            // Find songs for this set
            const listSetSongs = Object.values(setSongsMap)
                .filter((ss: any) => ss.set_id === set.id && !ss.deleted_at)
                .sort((a, b) => a.position - b.position);

            const songs = listSetSongs.map((ss: any) => ({
                id: ss.id,
                position: ss.position,
                // Handle raw snake_case from DB or camelCase from type
                songId: ss.song_id || ss.songId,
                set_id: ss.set_id, // Pass this through
                song_id: ss.song_id, // Pass this through
                song: songsMap[ss.song_id || ss.songId] || undefined,
                version: ss.version || 0 // Default for older records or optimistic
            }));

            return {
                ...set,
                songs,
                version: set.version || 0
            };
        });

        return {
            ...list,
            sets: hydratedSets
        };
    }).sort((a, b) => a.name.localeCompare(b.name));

  }, [setlistsMap, setsMap, setSongsMap, songsMap]);

  return { data, isLoading: false };
};

// Skipped Songs: Still uses React Query (Not cached persistently in store)
export const useSyncedSkippedSongs = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['skipped_songs_all'],
    queryFn: getAllSkippedSongs,
    enabled: !!user,
    staleTime: Infinity,
    gcTime: Infinity,
  });
};

// --- HYDRATION HELPERS ---

export const useSetlistWithSongs = (setlistId?: string) => {
  const { data: setlists } = useSyncedSetlists();
  return useMemo(() => {
      if (!setlistId) return null;
      return setlists.find(s => s.id === setlistId) || null;
  }, [setlistId, setlists]);
};

export const useSongFromCache = (songId?: string) => {
  const songsMap = useStore(state => state.songs);
  return useMemo(() => songsMap[songId!] || null, [songId, songsMap]);
};

// --- SYNC STATUS HELPER ---
export const useSyncStatus = () => {
    const isSyncing = useStore(state => state.isLoading && state.loadingMessage === 'Syncing changes...');
    const lastSyncedAtTime = useStore(state => state.lastSyncedAt);
    const syncDeltas = useStore(state => state.syncDeltas);
    const queryClient = useQueryClient();

    const refreshAll = useCallback(async () => {
        await syncDeltas();
        // Also refresh non-cached queries
        queryClient.invalidateQueries({ queryKey: ['skipped_songs_all'] });
    }, [syncDeltas, queryClient]);

    return { 
        isSyncing, 
        lastSyncedAt: lastSyncedAtTime ? new Date(lastSyncedAtTime).getTime() : 0, 
        refreshAll 
    };
};