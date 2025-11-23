const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET;

export interface MusicResult {
  id: string; // Spotify ID
  title: string;
  artist: string;
  album?: string;
}

export interface AudioFeatures {
  key?: string;
  tempo?: string;
}

let spotifyToken: string | null = null;
let tokenExpiration: number = 0;

const getSpotifyToken = async () => {
  if (spotifyToken && Date.now() < tokenExpiration) {
    return spotifyToken;
  }

  try {
    const auth = btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`);
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      console.error("Spotify Auth Error", await response.text());
      throw new Error('Failed to authenticate with Spotify');
    }

    const data = await response.json();
    spotifyToken = data.access_token;
    tokenExpiration = Date.now() + (data.expires_in * 1000);
    return spotifyToken;
  } catch (error) {
    console.error("Spotify Token Error:", error);
    throw error;
  }
};

export const searchMusic = async (query: string): Promise<MusicResult[]> => {
  if (!query) return [];

  try {
    const token = await getSpotifyToken();
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`, 
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    if (!response.ok) throw new Error("Spotify search failed");

    const data = await response.json();
    const tracks = data.tracks.items;

    // De-duplication: Key by "Artist-Title" to remove obvious duplicates
    const seen = new Set<string>();
    const results: MusicResult[] = [];

    for (const track of tracks) {
      const artist = track.artists[0].name;
      const title = track.name;
      const key = `${artist.toLowerCase().trim()}|${title.toLowerCase().trim()}`;

      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          id: track.id,
          title: track.name,
          artist: track.artists.map((a: any) => a.name).join(", "),
          album: track.album.name
        });
      }
    }

    return results.slice(0, 10);
  } catch (error) {
    console.error("Search Error:", error);
    return [];
  }
};

const PITCH_CLASS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const fetchAudioFeatures = async (spotifyId: string): Promise<AudioFeatures> => {
  try {
    const token = await getSpotifyToken();
    const response = await fetch(
      `https://api.spotify.com/v1/audio-features/${spotifyId}`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    if (!response.ok) return {};

    const data = await response.json();
    
    // Convert Pitch Class + Mode to String
    // key: integer 0-11. -1 if no key detected.
    // mode: 0 (Minor), 1 (Major)
    let keyString = "";
    if (data && data.key !== null && data.key >= 0 && data.key < 12) {
      const note = PITCH_CLASS[data.key];
      const mode = data.mode === 1 ? "Major" : "Minor";
      keyString = `${note} ${mode}`;
    }

    return {
      key: keyString,
      tempo: data.tempo ? Math.round(data.tempo).toString() : ""
    };
  } catch (error) {
    console.error("Audio Features Error:", error);
    return {};
  }
};

// Helper to clean strings for better lyrics matching
const cleanForLyrics = (str: string) => {
  return str
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/\s*\[.*?\]\s*/g, '')
    .replace(/\s*-\s*.*remaster.*/i, '')
    .replace(/\s*-\s*.*live.*/i, '')
    .replace(/\s*feat\..*/i, '')
    .trim();
};

export const fetchLyrics = async (artist: string, title: string) => {
  try {
    const attemptFetch = async (a: string, t: string) => {
      const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(a)}/${encodeURIComponent(t)}`);
      if (res.ok) {
        const data = await res.json();
        return data.lyrics || "";
      }
      return null;
    };

    // 1. Exact match
    let lyrics = await attemptFetch(artist, title);
    if (lyrics) return lyrics;

    // 2. Cleaned match
    const cleanArtist = cleanForLyrics(artist);
    const cleanTitle = cleanForLyrics(title);
    
    if (cleanArtist !== artist || cleanTitle !== title) {
      await new Promise(r => setTimeout(r, 200)); // Rate limit niceness
      lyrics = await attemptFetch(cleanArtist, cleanTitle);
      if (lyrics) return lyrics;
    }

    return "";
  } catch (error) {
    console.warn("Lyrics fetch failed", error);
    return "";
  }
};