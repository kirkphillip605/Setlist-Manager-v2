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
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  version: number;
}

export interface SetSong {
  id: string;
  position: number;
  songId: string;
  // Included for raw DB compatibility
  song_id?: string;
  set_id: string;
  
  song?: Song; // Hydrated song data
  created_by?: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  version: number;
}

export interface Set {
  id: string;
  name: string;
  position: number;
  setlist_id: string;
  songs: SetSong[];
  created_by?: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  version: number;
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
  deleted_at?: string | null;
  deleted_by?: string | null;
  version: number;
}

export interface Gig {
  id: string;
  name: string;
  start_time: string;
  end_time: string | null;
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
  deleted_at?: string | null;
  deleted_by?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  version: number;
}

export interface GigSession {
  id: string;
  gig_id: string;
  leader_id: string;
  current_set_index: number;
  current_song_index: number;
  adhoc_song_id: string | null;
  is_active: boolean;
  is_on_break: boolean;
  started_at: string;
  last_heartbeat: string;
  ended_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  version: number;
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
  };
  deleted_at?: string | null;
  version: number;
}

export type UserRole = 'admin' | 'manager' | 'standard';

export interface UserPreferences {
  tempo_blinker_enabled?: boolean;
  tempo_blinker_color?: string; // 'red', 'green', 'blue', 'amber'
  performance_view?: 'full' | 'simple';
  metronome_click_sound?: 'click1' | 'click2' | 'click3' | 'click4' | 'click5';
}

export interface Profile {
  id: string;
  email?: string | null;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  role: UserRole;
  is_approved: boolean;
  is_active: boolean;
  has_password: boolean;
  avatar_url?: string;
  preferences?: UserPreferences;
  deleted_at?: string | null;
  deleted_by?: string | null;
  version: number;
}