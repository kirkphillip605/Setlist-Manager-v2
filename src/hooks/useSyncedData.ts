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
        await Promise.all([
            engine.syncTable('songs', ['songs']),
            engine.syncTable('gigs', ['gigs']),
            engine.syncTable('gig_skipped_songs', ['skipped_songs_all']),
            // Setlists are complex. We might need a specialized sync strategy or
            // fallback to invalidation if structure changes are too complex to patch locally easily.
            // For now, we will attempt to sync the 'setlists' table metadata.
            // Deep structural changes might still require refetch for safety until 
            // a full normalized cache is implemented.
        ]);
        
        // For setlists, we invalidate for now to guarantee consistency
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
          // Trigger Delta Sync on any change
          console.log("Realtime change detected:", payload.table);
          if (['songs', 'gigs', 'gig_skipped_songs'].includes(payload.table)) {
              runDeltaSync();
          } else if (['setlists', 'sets', 'set_songs'].includes(payload.table)) {
              // For setlists, we invalidate for now to guarantee consistency
              queryClient.invalidateQueries({ queryKey: ['setlists'] });
          }
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

// Skipped Songs: Cached, Delta Synced
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
    const queryClient = useQueryClient(); // FIX: Call hook at top level
    const isFetching = queryClient.isFetching() > 0;
    
    // We can expose the sync trigger
    const refreshAll = useCallback(async () => {
        await runDeltaSync();
        // Force setlists refresh too
        queryClient.invalidateQueries({ queryKey: ['setlists'] });
    }, [runDeltaSync, queryClient]);

    return { 
        isSyncing: isFetching, 
        lastSyncedAt: Date.now(), // Simplified, ideally track actual timestamp
        refreshAll 
    };
};