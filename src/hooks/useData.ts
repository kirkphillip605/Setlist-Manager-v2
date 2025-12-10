import { useQuery } from "@tanstack/react-query";
import { getSongs, getSetlists } from "@/lib/api";
import { Song, Setlist } from "@/types";
import { useMemo } from "react";

// --- MASTER CATALOG HOOKS ---

export const useAllSongs = () => {
  return useQuery({
    queryKey: ['songs'],
    queryFn: getSongs,
    // Master Catalog Strategy:
    // Load once, keep forever (until manual invalidation or app restart)
    staleTime: Infinity, 
    gcTime: Infinity,
  });
};

export const useAllSetlists = () => {
  return useQuery({
    queryKey: ['setlists'],
    queryFn: getSetlists,
    staleTime: Infinity,
    gcTime: Infinity,
  });
};

// --- SELECTORS / HYDRATORS ---

// This hook joins the lightweight Setlist data with the heavy Song Catalog
// strictly in memory. This allows viewing setlists offline without 
// fetching individual song details again.
export const useSetlistWithSongs = (setlistId?: string) => {
  const { data: allSongs = [] } = useAllSongs();
  const { data: allSetlists = [] } = useAllSetlists();

  return useMemo(() => {
    if (!setlistId) return null;

    const setlist = allSetlists.find(s => s.id === setlistId);
    if (!setlist) return null;

    // Deep clone to avoid mutating the cache reference
    // and hydrate the songs from the Master Catalog
    const hydratedSets = setlist.sets.map(set => ({
      ...set,
      songs: set.songs.map(setSong => {
        const fullSongDetails = allSongs.find(s => s.id === setSong.songId);
        return {
          ...setSong,
          song: fullSongDetails || setSong.song // Fallback to existing if available
        };
      })
    }));

    return {
      ...setlist,
      sets: hydratedSets
    };
  }, [setlistId, allSetlists, allSongs]);
};

// Helper to get a single song from the cache without a network call
export const useSongFromCache = (songId?: string) => {
  const { data: allSongs = [] } = useAllSongs();
  return useMemo(() => {
    return allSongs.find(s => s.id === songId) || null;
  }, [songId, allSongs]);
};