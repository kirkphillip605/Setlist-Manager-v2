const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET;

export interface MusicResult {
  id: string; // Spotify ID
  title: string;
  artist: string;
  album?: string;
  coverUrl?: string;
  spotifyUrl?: string;
}

export interface AudioFeatures {
  key?: string;
  tempo?: string;
}

// Helper: Fetch with timeout to prevent hanging UI
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 5000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

let spotifyToken: string | null = null;
let tokenExpiration: number = 0;

const getSpotifyToken = async () => {
  if (spotifyToken && Date.now() < tokenExpiration) {
    return spotifyToken;
  }

  try {
    const auth = btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`);
    const response = await fetchWithTimeout('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    }, 5000); // 5s timeout for auth

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
    const response = await fetchWithTimeout(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`, 
      {
        headers: { 'Authorization': `Bearer ${token}` }
      },
      8000 // 8s timeout for search
    );

    if (!response.ok) throw new Error("Spotify search failed");

    const data = await response.json();
    const tracks = data.tracks.items;

    const seen = new Set<string>();
    const results: MusicResult[] = [];

    for (const track of tracks) {
      const artist = track.artists[0].name;
      const title = track.name;
      const key = `${artist.toLowerCase().trim()}|${title.toLowerCase().trim()}`;
      
      const image = track.album.images[1]?.url || track.album.images[0]?.url || "";
      const spotifyUrl = track.external_urls?.spotify || "";

      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          id: track.id,
          title: track.name,
          artist: track.artists.map((a: any) => a.name).join(", "),
          album: track.album.name,
          coverUrl: image,
          spotifyUrl: spotifyUrl
        });
      }
    }

    return results.slice(0, 10);
  } catch (error) {
    console.error("Search Error:", error);
    return [];
  }
};

// Enharmonic mappings favored for guitarists
// Mode 1 = Major, Mode 0 = Minor
const MAJOR_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];

export const fetchAudioFeatures = async (spotifyId: string): Promise<AudioFeatures> => {
  if (!spotifyId) return {};
  
  console.log(`Fetching audio features for ID: ${spotifyId}`);
  try {
    const token = await getSpotifyToken();
    // Direct call to audio-features endpoint with the track ID
    const response = await fetchWithTimeout(
      `https://api.spotify.com/v1/audio-features/${spotifyId}`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      },
      6000 // 6s timeout for features
    );

    if (!response.ok) {
        console.error("Audio Features API Error:", await response.text());
        return {};
    }

    const data = await response.json();
    console.log("Spotify Audio Features Response:", data);
    
    let keyString = "";
    
    // Check if key is a valid number (0-11)
    if (data && typeof data.key === 'number' && data.key >= 0 && data.key < 12) {
      const pitchClass = data.key;
      const mode = data.mode; // 1 = Major, 0 = Minor

      if (mode === 1) {
        keyString = `${MAJOR_KEYS[pitchClass]} Major`;
      } else {
        keyString = `${MINOR_KEYS[pitchClass]} Minor`;
      }
    }

    // Parse Tempo: Round to nearest whole number
    let tempoString = "";
    if (data && typeof data.tempo === 'number') {
      tempoString = Math.round(data.tempo).toString();
    }

    const result = {
      key: keyString,
      tempo: tempoString
    };
    
    console.log("Parsed Audio Features:", result);
    return result;
  } catch (error) {
    console.error("Audio Features Exception:", error);
    return {};
  }
};

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
  console.log(`Fetching lyrics for: ${artist} - ${title}`);
  try {
    const attemptFetch = async (a: string, t: string) => {
      // 4 second timeout for lyrics as this API can be slow/unreliable
      const res = await fetchWithTimeout(
        `https://api.lyrics.ovh/v1/${encodeURIComponent(a)}/${encodeURIComponent(t)}`,
        {},
        4000
      );
      if (res.ok) {
        const data = await res.json();
        return data.lyrics || "";
      }
      return null;
    };

    let lyrics = await attemptFetch(artist, title);
    if (lyrics) return lyrics;

    const cleanArtist = cleanForLyrics(artist);
    const cleanTitle = cleanForLyrics(title);
    
    if (cleanArtist !== artist || cleanTitle !== title) {
      // Short delay before retry not needed with fetchWithTimeout logic usually, 
      // but keeping logic simple. 
      lyrics = await attemptFetch(cleanArtist, cleanTitle);
      if (lyrics) return lyrics;
    }

    return "";
  } catch (error) {
    console.warn("Lyrics fetch failed or timed out", error);
    return "";
  }
};