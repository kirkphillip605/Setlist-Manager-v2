import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useCallback, useRef } from "react";
import { getSongs, getSetlists, getGigs, getAllSkippedSongs } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { SyncEngine } from "@/lib/syncEngine";
import { toast } from "sonner";

// --- Sync Coordination ---

export const useSyncManager = () => {
  const queryClient = useQueryClient();
  const engine = useMemo(() => new SyncEngine(queryClient), [queryClient]);
  const isSyncingRef = useRef(false);
  const { user } = useAuth();

  const runDeltaSync = useCallback(async () => {
    if (isSyncingRef.current || !user) return;
    isSyncingRef.current = true;
    
    try {
        // Parallel sync of independent tables
        // Note: gig_skipped_songs, gig_sessions, etc are realtime-only and handled via invalidation or specific subscriptions
        await Promise.all([
            engine.syncTable('songs', ['songs']),
            engine.syncTable('gigs', ['gigs']),
        ]);
        
        // For setlists, we invalidate to guarantee consistency due to complex nested structure
        queryClient.invalidateQueries({ queryKey: ['setlists'] });
        
    } catch (e) {
        console.error("Delta Sync Failed", e);
    } finally {
        isSyncingRef.current = false;
    }
  }, [engine, user, queryClient]);

  // Realtime Listeners
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('global_sync_trigger')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
          console.log("Realtime change detected:", payload.table);
          
          // 1. Versioned Tables -> Delta Sync
          if (['songs', 'gigs'].includes(payload.table)) {
              runDeltaSync();
          } 
          // 2. Complex Nested Tables -> Invalidate
          else if (['setlists', 'sets', 'set_songs'].includes(payload.table)) {
              queryClient.invalidateQueries({ queryKey: ['setlists'] });
          }
          // 3. Realtime/Session Tables -> Simple Invalidation (No version sync)
          else if (payload.table === 'gig_skipped_songs') {
              queryClient.invalidateQueries({ queryKey: ['skipped_songs_all'] });
          }
          // Note: gig_sessions and participants are handled by specific hooks (useGigSession)
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, runDeltaSync, queryClient]);

  return { runDeltaSync };
};

// --- DATA HOOKS ---

// Songs: Cached, Delta Synced
export const useSyncedSongs = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['songs'],
    // Initial fetch: Get all active songs. 
    // Subsequent updates handled via Delta Sync (setQueryData).
    queryFn: getSongs, 
    enabled: !!user,
    staleTime: Infinity,
    gcTime: Infinity,
  });
};

// Gigs: Cached, Delta Synced
export const useSyncedGigs = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['gigs'],
    queryFn: getGigs,
    enabled: !!user,
    staleTime: Infinity,
    gcTime: Infinity,
  });
};

// Skipped Songs: Standard Query (Invalidated by realtime)
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

// Setlists: Cached, Re-fetched on change (Structure is too complex for simple delta patch without full normalization)
export const useSyncedSetlists = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['setlists'],
    queryFn: getSetlists,
    enabled: !!user,
    staleTime: Infinity,
    gcTime: Infinity,
  });
};

// --- HYDRATION HELPERS ---

export const useSetlistWithSongs = (setlistId?: string) => {
  const { data: allSongs = [] } = useSyncedSongs();
  const { data: allSetlists = [] } = useSyncedSetlists();

  return useMemo(() => {
    if (!setlistId) return null;

    const setlist = allSetlists.find(s => s.id === setlistId);
    if (!setlist) return null;

    // Deep clone and hydrate
    const hydratedSets = setlist.sets.map(set => ({
      ...set,
      songs: set.songs.map(setSong => {
        const fullSongDetails = allSongs.find(s => s.id === setSong.songId);
        return {
          ...setSong,
          song: fullSongDetails || setSong.song 
        };
      })
    }));

    return {
      ...setlist,
      sets: hydratedSets
    };
  }, [setlistId, allSetlists, allSongs]);
};

export const useSongFromCache = (songId?: string) => {
  const { data: allSongs = [] } = useSyncedSongs();
  return useMemo(() => {
    return allSongs.find(s => s.id === songId) || null;
  }, [songId, allSongs]);
};

// --- SYNC STATUS HELPER ---
export const useSyncStatus = () => {
    const { runDeltaSync } = useSyncManager();
    const queryClient = useQueryClient();
    const isFetching = queryClient.isFetching() > 0;
    
    // We can expose the sync trigger
    const refreshAll = useCallback(async () => {
        await runDeltaSync();
        // Force setlists refresh too
        queryClient.invalidateQueries({ queryKey: ['setlists'] });
        // Force skipped songs refresh
        queryClient.invalidateQueries({ queryKey: ['skipped_songs_all'] });
    }, [runDeltaSync, queryClient]);

    return { 
        isSyncing: isFetching, 
        lastSyncedAt: Date.now(), // Simplified, ideally track actual timestamp
        refreshAll 
    };
};