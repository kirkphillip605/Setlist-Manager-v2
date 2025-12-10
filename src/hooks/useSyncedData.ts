import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { getSongs, getSetlists, getGigs, getAllSkippedSongs } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// --- MASTER SONGS HOOK ---
export const useSyncedSongs = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['songs'],
    queryFn: getSongs,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  useEffect(() => {
    const channel = supabase
      .channel('public:songs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'songs' },
        () => queryClient.invalidateQueries({ queryKey: ['songs'] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
};

// --- MASTER SETLISTS HOOK ---
export const useSyncedSetlists = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['setlists'],
    queryFn: getSetlists,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  useEffect(() => {
    // Listen to all tables related to setlists structure
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

  return query;
};

// --- MASTER GIGS HOOK ---
export const useSyncedGigs = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gigs'],
    queryFn: getGigs,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  useEffect(() => {
    const channel = supabase
      .channel('public:gigs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gigs' },
        () => queryClient.invalidateQueries({ queryKey: ['gigs'] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
};

// --- MASTER SKIPPED SONGS HOOK ---
export const useSyncedSkippedSongs = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['skipped_songs_all'],
    queryFn: getAllSkippedSongs,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  useEffect(() => {
    const channel = supabase
      .channel('public:gig_skipped_songs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gig_skipped_songs' },
        () => queryClient.invalidateQueries({ queryKey: ['skipped_songs_all'] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
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