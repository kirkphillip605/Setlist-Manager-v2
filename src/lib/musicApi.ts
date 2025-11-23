import { Song } from "@/types";

interface iTunesResult {
  trackName: string;
  artistName: string;
  previewUrl: string;
  trackTimeMillis: number;
}

export const searchMusic = async (query: string) => {
  if (!query) return [];
  
  // Using iTunes Search API (Public, no key needed)
  const response = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=10`
  );
  
  if (!response.ok) {
    throw new Error("Failed to fetch from music service");
  }

  const data = await response.json();
  return data.results as iTunesResult[];
};

export const fetchLyrics = async (artist: string, title: string) => {
  try {
    // Using lyrics.ovh API (Public, no key needed)
    const response = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
    );
    
    if (!response.ok) return "";
    
    const data = await response.json();
    return data.lyrics || "";
  } catch (error) {
    console.warn("Failed to fetch lyrics", error);
    return "";
  }
};

// Helper to estimate tempo/key (Since public APIs rarely provide this for free, 
// we'll return empty strings, but the function structure allows for future API integration)
export const fetchAudioFeatures = async (artist: string, title: string) => {
  // Placeholder: Real implementation would likely require Spotify API with Auth
  return {
    key: "",
    tempo: "",
  };
};