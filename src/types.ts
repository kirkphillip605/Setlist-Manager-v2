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
  created_by?: string;
  last_updated_by?: string;
}

export interface SetSong {
  id: string;
  position: number;
  songId: string;
  song?: Song; // Hydrated song data
  created_by?: string;
}

export interface Set {
  id: string;
  name: string;
  position: number;
  songs: SetSong[];
  created_by?: string;
  last_updated_by?: string;
}

export interface Setlist {
  id: string;
  name: string;
  is_personal: boolean;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  last_updated_by?: string;
  sets: Set[];
}

export interface Gig {
  id: string;
  name: string;
  date: string;
  notes: string;
  setlist_id: string | null;
  setlist?: Setlist;
  venue_name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  created_by?: string;
  last_updated_by?: string;
}

export interface GigSession {
  id: string;
  gig_id: string;
  leader_id: string;
  current_set_index: number;
  current_song_index: number;
  adhoc_song_id: string | null;
  is_active: boolean;
  started_at: string;
  last_heartbeat: string;
  ended_at?: string | null;
}

export interface GigSessionParticipant {
  id: string;
  session_id: string;
  user_id: string;
  last_seen: string;
  profile?: {
    first_name: string;
    last_name: string;
    position: string;
  }
}