import { Song, Setlist } from "@/types";

const SONGS_KEY = "band_app_songs";
const SETLISTS_KEY = "band_app_setlists";

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

export const getSetlists = (): Setlist[] => {
  const data = localStorage.getItem(SETLISTS_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveSetlist = (setlist: Setlist) => {
  const setlists = getSetlists();
  const existingIndex = setlists.findIndex((s) => s.id === setlist.id);
  
  if (existingIndex >= 0) {
    setlists[existingIndex] = setlist;
  } else {
    setlists.push(setlist);
  }
  
  localStorage.setItem(SETLISTS_KEY, JSON.stringify(setlists));
  return setlist;
};

export const deleteSetlist = (id: string) => {
  const setlists = getSetlists();
  const newSetlists = setlists.filter((s) => s.id !== id);
  localStorage.setItem(SETLISTS_KEY, JSON.stringify(newSetlists));
};