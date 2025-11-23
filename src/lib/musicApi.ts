export interface iTunesResult {
  trackName: string;
  artistName: string;
  previewUrl: string;
  trackTimeMillis: number;
  collectionName?: string;
}

export const searchMusic = async (query: string) => {
  if (!query) return [];
  
  // Increase limit to 25 to allow for de-duplication filtering downstream
  const response = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=25`
  );
  
  if (!response.ok) {
    throw new Error("Failed to fetch from music service");
  }

  const data = await response.json();
  const results = data.results as iTunesResult[];
  
  // De-duplicate results based on normalized Artist + Title
  // This prevents seeing "Song A", "Song A (Remastered)", "Song A (Live)" as clutter if they are essentially the same for lyrics.
  // We prioritize the shortest title (usually the original) or the first one found.
  const uniqueResults: iTunesResult[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    const key = `${result.artistName.toLowerCase().trim()}|${result.trackName.toLowerCase().trim()}`;
    
    // Simple de-dupe logic: if we haven't seen this combo, add it.
    if (!seen.has(key)) {
      seen.add(key);
      uniqueResults.push(result);
    }
  }

  // Return top 10 unique results
  return uniqueResults.slice(0, 10);
};

// Helper to clean strings for better lyrics matching (e.g. remove "Remastered", "(Live)", etc.)
const cleanForLyrics = (str: string) => {
  return str
    .replace(/\s*\(.*?\)\s*/g, '') // Remove content in parentheses
    .replace(/\s*\[.*?\]\s*/g, '') // Remove content in brackets
    .replace(/\s*-\s*.*remaster.*/i, '') // Remove " - ... Remaster..."
    .replace(/\s*-\s*.*live.*/i, '') // Remove " - ... Live..."
    .replace(/\s*feat\..*/i, '') // Remove "feat. ..."
    .trim();
};

export const fetchLyrics = async (artist: string, title: string) => {
  try {
    // 1. Try exact match first
    let response = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data.lyrics) return data.lyrics;
    }

    // 2. Try cleaned versions if exact match failed
    const cleanArtist = cleanForLyrics(artist);
    const cleanTitle = cleanForLyrics(title);

    // Only retry if cleaning actually changed the string to avoid redundant 404 calls
    if (cleanArtist !== artist || cleanTitle !== title) {
      // Small delay to be nice to the API if we are retrying immediately
      await new Promise(r => setTimeout(r, 200)); 
      
      response = await fetch(
        `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        return data.lyrics || "";
      }
    }

    return "";
  } catch (error) {
    console.warn("Failed to fetch lyrics", error);
    return "";
  }
};

export const fetchAudioFeatures = async (artist: string, title: string) => {
  return {
    key: "",
    tempo: "",
  };
};