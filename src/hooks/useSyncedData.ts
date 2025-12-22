import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useCallback } from "react";
import { getSongs, getSetlists, getGigs, getAllSkippedSongs } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

const REFETCH_INTERVAL = 1000 * 60 * 5; // 5 minutes

// Helper to subscribe to realtime changes
const useRealtimeSubscription = (table: string, queryKey: string[]) => {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const channel = supabase
      .channel(`public:${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: table },
        () => {
            console.log(`Realtime update for ${table}, invalidating ${queryKey}`);
            queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, table, JSON.stringify(queryKey)]);
};

// --- MASTER SONGS HOOK ---
export const useSyncedSongs = () => {
  const { user } = useAuth();
  
  useRealtimeSubscription('songs', ['songs']);

  return useQuery({
    queryKey: ['songs'],
    queryFn: getSongs,
    enabled: !!user, // Only fetch if we have a user
    staleTime: Infinity, // Rely on realtime/invalidation
    gcTime: Infinity, // Keep in cache forever
    refetchInterval: REFETCH_INTERVAL,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });
};

// --- MASTER SETLISTS HOOK ---
export const useSyncedSetlists = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Setlists are complex, listen to related tables
  useEffect(() => {
    const channel = supabase
      .channel('public:setlists_agg')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'setlists' }, () => {
          queryClient.invalidateQueries({ queryKey: ['setlists'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sets' }, () => {
          queryClient.invalidateQueries({ queryKey: ['setlists'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'set_songs' }, () => {
          queryClient.invalidateQueries({ queryKey: ['setlists'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['setlists'],
    queryFn: getSetlists,
    enabled: !!user,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchInterval: REFETCH_INTERVAL,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });
};

// --- MASTER GIGS HOOK ---
export const useSyncedGigs = () => {
  const { user } = useAuth();
  
  useRealtimeSubscription('gigs', ['gigs']);

  return useQuery({
    queryKey: ['gigs'],
    queryFn: getGigs,
    enabled: !!user,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchInterval: REFETCH_INTERVAL,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });
};

// --- MASTER SKIPPED SONGS HOOK ---
export const useSyncedSkippedSongs = () => {
  const { user } = useAuth();
  
  useRealtimeSubscription('gig_skipped_songs', ['skipped_songs_all']);

  return useQuery({
    queryKey: ['skipped_songs_all'],
    queryFn: getAllSkippedSongs,
    enabled: !!user,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchInterval: REFETCH_INTERVAL,
    refetchOnMount: true,
    refetchOnReconnect: true,
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
    const songs = useSyncedSongs();
    const setlists = useSyncedSetlists();
    const gigs = useSyncedGigs();
    
    const isSyncing = songs.isFetching || setlists.isFetching || gigs.isFetching;
    const lastSyncedAt = Math.max(
        songs.dataUpdatedAt, 
        setlists.dataUpdatedAt, 
        gigs.dataUpdatedAt
    );
    
    const queryClient = useQueryClient();

    const refreshAll = useCallback(async () => {
        console.log("Manual Sync Triggered");
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['songs'] }),
            queryClient.invalidateQueries({ queryKey: ['setlists'] }),
            queryClient.invalidateQueries({ queryKey: ['gigs'] }),
            queryClient.invalidateQueries({ queryKey: ['skipped_songs_all'] }),
            queryClient.invalidateQueries({ queryKey: ['profile'] })
        ]);
        await Promise.all([
            queryClient.refetchQueries({ queryKey: ['songs'] }),
            queryClient.refetchQueries({ queryKey: ['setlists'] }),
            queryClient.refetchQueries({ queryKey: ['gigs'] }),
            queryClient.refetchQueries({ queryKey: ['skipped_songs_all'] }),
             queryClient.refetchQueries({ queryKey: ['profile'] })
        ]);
    }, [queryClient]);

    return { isSyncing, lastSyncedAt, refreshAll };
};