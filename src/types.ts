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
  is_retired?: boolean;
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
  // date: string; // Deprecated
  // is_tbd: boolean; // Deprecated
  is_personal: boolean;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
  sets: Set[];
}

export interface Gig {
  id: string;
  name: string;
  date: string;
  notes: string;
  setlist_id: string | null;
  setlist?: Setlist;
  
  // New Fields
  venue_name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}