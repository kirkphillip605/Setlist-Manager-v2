import { useStore } from "@/lib/store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useCallback, useRef } from "react";
import { getAllSkippedSongs } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

// --- Sync Coordination ---

export const useSyncManager = () => {
  const syncDeltas = useStore(state => state.syncDeltas);
  const processRealtimeUpdate = useStore(state => state.processRealtimeUpdate);
  const setOnlineStatus = useStore(state => state.setOnlineStatus);
  const initialize = useStore(state => state.initialize);
  
  const { user } = useAuth();
  const userId = user?.id; // Extract ID for stable dependency
  
  const queryClient = useQueryClient();

  // 1. Connectivity & Visibility Listeners
  useEffect(() => {
    const handleOnline = () => {
        console.log("[Sync] App is Online");
        setOnlineStatus(true);
        syncDeltas();
    };
    const handleOffline = () => {
        console.log("[Sync] App is Offline");
        setOnlineStatus(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleVisibility = () => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
            syncDeltas();
        }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Polling Fallback (5 min) to catch missed events if socket dies silently
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
  }, []); // Static listeners, run once

  // 2. Realtime Subscription
  // We use a ref to track if we are already subscribed to avoid double-firing in strict mode or rapid re-renders
  useEffect(() => {
    if (!userId) return;

    console.log("[Sync] Initializing Realtime Subscription...");
    
    const channel = supabase.channel('global_data_sync')
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public' }, 
        (payload) => {
          // 1. Update Local Store (Optimistic) + Trigger Delta Sync (Verification)
          processRealtimeUpdate(payload);

          // 2. Handle React Query Cache (Non-persisted data)
          if (payload.table === 'gig_skipped_songs') {
              queryClient.invalidateQueries({ queryKey: ['skipped_songs_all'] });
          }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log("[Sync] Channel Subscribed");
        } else if (status === 'CHANNEL_ERROR') {
            console.error("[Sync] Channel Connection Error - Retrying in background");
        }
      });

    return () => { 
        console.log("[Sync] Cleaning up subscription");
        supabase.removeChannel(channel); 
    };
    // DEPENDENCY FIX: Only re-run if userId changes. 
    // internal store functions are stable, queryClient is stable.
  }, [userId]); 

  return { runDeltaSync: syncDeltas, initialize };
};

// --- DATA SELECTORS (Hooks) ---

const activeFilter = (item: any) => !item.deleted_at;

export const useSyncedSongs = () => {
  const songsMap = useStore(state => state.songs);
  const data = useMemo(() => Object.values(songsMap).filter(activeFilter).sort((a,b) => a.title.localeCompare(b.title)), [songsMap]);
  return { data, isLoading: false }; 
};

export const useSyncedGigs = () => {
  const gigsMap = useStore(state => state.gigs);
  const setlistsMap = useStore(state => state.setlists); 
  
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

export const useSyncedSetlists = () => {
  const setlistsMap = useStore(state => state.setlists);
  const setsMap = useStore(state => state.sets);
  const setSongsMap = useStore(state => state.set_songs);
  const songsMap = useStore(state => state.songs);

  const data = useMemo(() => {
    const rawSetlists = Object.values(setlistsMap).filter(activeFilter);
    
    return rawSetlists.map(list => {
        // Sets
        const listSets = Object.values(setsMap)
            // @ts-ignore
            .filter((s: any) => s.setlist_id === list.id && !s.deleted_at)
            // @ts-ignore
            .sort((a, b) => a.position - b.position);

        const hydratedSets = listSets.map(set => {
            // Set Songs
            const listSetSongs = Object.values(setSongsMap)
                // @ts-ignore
                .filter((ss: any) => ss.set_id === set.id && !ss.deleted_at)
                // @ts-ignore
                .sort((a, b) => a.position - b.position);

            const songs = listSetSongs.map((ss: any) => ({
                id: ss.id,
                position: ss.position,
                songId: ss.song_id || ss.songId,
                set_id: ss.set_id, 
                song_id: ss.song_id, 
                // @ts-ignore
                song: songsMap[ss.song_id || ss.songId] || undefined,
                version: ss.version || 0 
            }));

            return {
                ...set,
                songs,
                // @ts-ignore
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

// --- LEGACY ALIASES (Migration Support) ---
export const useAllSongs = useSyncedSongs;
export const useAllSetlists = useSyncedSetlists;

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
    const { runDeltaSync } = useSyncManager();
    const isSyncing = useStore(state => state.isSyncing);
    const lastSyncedAtTime = useStore(state => state.lastSyncedAt);
    const queryClient = useQueryClient();

    const refreshAll = useCallback(async () => {
        await runDeltaSync();
        queryClient.invalidateQueries({ queryKey: ['skipped_songs_all'] });
    }, [runDeltaSync, queryClient]);

    return { 
        isSyncing, 
        lastSyncedAt: lastSyncedAtTime ? new Date(lastSyncedAtTime).getTime() : 0, 
        refreshAll 
    };
};