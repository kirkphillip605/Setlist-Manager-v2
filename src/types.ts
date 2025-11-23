export interface Song {
  id: string;
  artist: string;
  title: string;
  lyrics: string;
  key: string;
  tempo: string;
  duration: string; // "MM:SS" format
  note: string;
  cover_url?: string;
  spotify_url?: string;
}

export interface SetSong {
  id: string;
  position: number;
  songId: string;
  song?: Song; // Hydrated song data
}

export interface Set {
  id: string;
  name: string;
  position: number;
  songs: SetSong[];
}

export interface Setlist {
  id: string;
  name: string;
  date: string;
  sets: Set[];
}