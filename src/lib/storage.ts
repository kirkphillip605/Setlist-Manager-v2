import { Song, Setlist } from "@/types";

const SONGS_KEY = "band_app_songs";
const SETLISTS_KEY = "band_app_setlists";

// --- Songs ---

export const getSongs = (): Song[] => {
  const data = localStorage.getItem(SONGS_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveSong = (song: Song) => {
  const songs = getSongs();
  const existingIndex = songs.findIndex((s) => s.id === song.id);
  
  if (existingIndex >= 0) {
    songs[existingIndex] = song;
  } else {
    songs.push(song);
  }
  
  localStorage.setItem(SONGS_KEY, JSON.stringify(songs));
  return song;
};

export const deleteSong = (id: string) => {
  const songs = getSongs();
  const newSongs = songs.filter((s) => s.id !== id);
  localStorage.setItem(SONGS_KEY, JSON.stringify(newSongs));
};

// --- Setlists ---

export const getSetlists = (): Setlist[] => {
  const data = localStorage.getItem(SETLISTS_KEY);
  let setlists: Setlist[] = data ? JSON.parse(data) : [];
  
  // "Hydrate" the songs (simulate a SQL JOIN)
  // We store IDs but want to return full objects for the UI
  const allSongs = getSongs();
  
  setlists = setlists.map(list => ({
    ...list,
    sets: list.sets.map(set => ({
      ...set,
      songs: set.songs.map(setSong => ({
        ...setSong,
        song: allSongs.find(s => s.id === setSong.songId)
      })).filter(s => s.song !== undefined) // Remove songs that might have been deleted
    }))
  }));

  return setlists;
};

export const getSetlistById = (id: string): Setlist | undefined => {
  return getSetlists().find(s => s.id === id);
};

export const saveSetlist = (setlist: Setlist) => {
  // We need to strip out the hydrated 'song' objects before saving to avoid data duplication
  // and stale data issues, mimicking a normalized DB structure.
  const allSetlists = getSetlists();
  
  const normalizedSetlist = {
    ...setlist,
    sets: setlist.sets.map(set => ({
      ...set,
      songs: set.songs.map(({ song, ...rest }) => rest) // Remove 'song' property
    }))
  };

  const existingIndex = allSetlists.findIndex((s) => s.id === setlist.id);
  
  // We need to get the "raw" list from storage to save, not the hydrated one
  const rawData = localStorage.getItem(SETLISTS_KEY);
  const rawSetlists: Setlist[] = rawData ? JSON.parse(rawData) : [];
  
  if (existingIndex >= 0) {
    rawSetlists[existingIndex] = normalizedSetlist;
  } else {
    rawSetlists.push(normalizedSetlist);
  }
  
  localStorage.setItem(SETLISTS_KEY, JSON.stringify(rawSetlists));
  return setlist;
};

export const deleteSetlist = (id: string) => {
  const rawData = localStorage.getItem(SETLISTS_KEY);
  const rawSetlists: Setlist[] = rawData ? JSON.parse(rawData) : [];
  const newSetlists = rawSetlists.filter((s) => s.id !== id);
  localStorage.setItem(SETLISTS_KEY, JSON.stringify(newSetlists));
};