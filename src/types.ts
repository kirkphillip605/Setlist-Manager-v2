export interface Song {
  id: string;
  artist: string;
  title: string;
  lyrics: string;
  key: string;
  tempo: string;
  note: string;
}

export interface Setlist {
  id: string;
  name: string;
  date: string;
  songs: string[]; // Array of song IDs
}