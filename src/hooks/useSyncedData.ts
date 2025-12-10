import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getSongs, getSetlists } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMemo } from "react";

// --- MASTER SONGS HOOK ---
export const useSyncedSongs = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['songs'],
    queryFn: getSongs,
    staleTime: Infinity, // Never consider stale (unless manually invalidated)
    gcTime: Infinity,    // Keep in garbage collection forever
  });

  useEffect(() => {
    const channel = supabase
      .channel('public:songs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'songs' },
        (payload) => {
          console.log('Realtime update (Songs):', payload);
          // Invalidate cache to trigger re-fetch
          queryClient.invalidateQueries({ queryKey: ['songs'] });
          // Optional: Show toast for external changes
          if (payload.eventType !== 'DELETE') {
             // toast.info("Repertoire updated from cloud");
          }
        }
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
    // Listen to changes on setlists, sets, OR set_songs
    // Note: Supabase Realtime only listens to one table per channel definition usually,
    // so we might need multiple listeners if we want deep reactivity. 
    // For simplicity, we listen to setlists and rely on optimistic updates for deep edits.
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

// --- HYDRATION HELPERS ---

// Gets a specific Setlist and "joins" it with the Master Song Cache
// This allows full song details (lyrics, bpm) without re-fetching
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
        // Find the full song data in the Master Cache
        const fullSongDetails = allSongs.find(s => s.id === setSong.songId);
        return {
          ...setSong,
          // Use full details if available, otherwise fall back to whatever (if any) was in the setlist fetch
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

// Helper for looking up a single song from cache
export const useSongFromCache = (songId?: string) => {
  const { data: allSongs = [] } = useSyncedSongs();
  return useMemo(() => {
    return allSongs.find(s => s.id === songId) || null;
  }, [songId, allSongs]);
};