import { supabase } from "@/integrations/supabase/client";
import { Song, Setlist, Set as SetType, SetSong } from "@/types";

// --- Types Helper ---
// Helper interfaces to match Supabase raw response structure which differs from our App types
interface SupabaseSetSong {
  id: string;
  position: number;
  song_id: string; // Matches DB column name
  song: Song | null;
}

interface SupabaseSet {
  id: string;
  name: string;
  position: number;
  set_songs: SupabaseSetSong[];
}

interface SupabaseSetlist extends Omit<Setlist, 'sets'> {
  sets: SupabaseSet[];
}

// --- Songs ---

export const getSongs = async (): Promise<Song[]> => {
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .order('title');
  
  if (error) throw error;
  return data as Song[];
};

export const getSong = async (id: string): Promise<Song | null> => {
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) return null;
  return data as Song;
};

export const saveSong = async (song: Partial<Song>) => {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("No user found");

  // Sanitize undefined values for optional fields
  const songData = {
    title: song.title,
    artist: song.artist,
    lyrics: song.lyrics || "",
    key: song.key || "",
    tempo: song.tempo || "",
    duration: song.duration || "",
    note: song.note || "",
    cover_url: song.cover_url || null,
    spotify_url: song.spotify_url || null,
    is_retired: song.is_retired || false,
    updated_at: new Date().toISOString()
  };

  if (song.id) {
    // UPDATE
    const { data, error } = await supabase
      .from('songs')
      .update(songData)
      .eq('id', song.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    // INSERT
    const { data, error } = await supabase
      .from('songs')
      .insert({ 
        ...songData, 
        user_id: user.id
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

export const deleteSong = async (id: string) => {
  const { error } = await supabase.from('songs').delete().eq('id', id);
  if (error) throw error;
};

export const getSongUsage = async (songId: string): Promise<{ setlistName: string; date: string }[]> => {
  // Find all set_songs entries for this song, joining up to setlists
  const { data, error } = await supabase
    .from('set_songs')
    .select(`
      sets (
        setlists (
          name,
          date
        )
      )
    `)
    .eq('song_id', songId);

  if (error) throw error;

  // Flatten the structure to return unique setlists
  const usage: { setlistName: string; date: string }[] = [];
  const seen = new Set<string>();

  data.forEach((item: any) => {
    const setlist = item.sets?.setlists;
    if (setlist) {
      const key = `${setlist.name}-${setlist.date}`;
      if (!seen.has(key)) {
        seen.add(key);
        usage.push({
          setlistName: setlist.name,
          date: setlist.date
        });
      }
    }
  });

  return usage;
};

// --- Setlists ---

export const getSetlists = async (): Promise<Setlist[]> => {
  const { data, error } = await supabase
    .from('setlists')
    .select(`
      *,
      sets (
        *,
        set_songs (
          *,
          song:songs (*)
        )
      )
    `)
    .order('date', { ascending: false });

  if (error) throw error;

  // Type assertion step to ensure data matches our expected Supabase structure
  const rawSetlists = data as unknown as SupabaseSetlist[];

  return rawSetlists.map(list => ({
    ...list,
    sets: list.sets
      .sort((a, b) => a.position - b.position)
      .map(set => ({
        id: set.id,
        name: set.name,
        position: set.position,
        songs: set.set_songs
          .sort((a, b) => a.position - b.position)
          .map(ss => ({
            id: ss.id,
            position: ss.position,
            songId: ss.song_id, // Map snake_case to camelCase
            song: ss.song || undefined 
          }))
      }))
  }));
};

export const getSetlist = async (id: string): Promise<Setlist | null> => {
  const { data, error } = await supabase
    .from('setlists')
    .select(`
      *,
      sets (
        *,
        set_songs (
          *,
          song:songs (*)
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error) return null;

  const list = data as unknown as SupabaseSetlist;

  return {
    ...list,
    sets: list.sets
      .sort((a, b) => a.position - b.position)
      .map(set => ({
        id: set.id,
        name: set.name,
        position: set.position,
        songs: set.set_songs
          .sort((a, b) => a.position - b.position)
          .map(ss => ({
            id: ss.id,
            position: ss.position,
            songId: ss.song_id, // Map snake_case to camelCase
            song: ss.song || undefined
          }))
      }))
  };
};

export const createSetlist = async (name: string, date: string, isPersonal: boolean = false) => {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("No user");

  const { data, error } = await supabase
    .from('setlists')
    .insert({ name, date, user_id: user.id, is_personal: isPersonal })
    .select()
    .single();
    
  if (error) throw error;
  return data;
};

export const updateSetlist = async (id: string, updates: Partial<Setlist>) => {
  const { data, error } = await supabase
    .from('setlists')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const cloneSetlist = async (sourceId: string, newName: string, newDate: string, isPersonal: boolean) => {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("No user");

  const { data, error } = await supabase.rpc('clone_setlist', {
    source_setlist_id: sourceId,
    new_name: newName,
    new_date: newDate,
    is_personal_copy: isPersonal,
    owner_id: user.id
  });

  if (error) throw error;
  return data;
};

export const deleteSetlist = async (id: string) => {
  const { error } = await supabase.from('setlists').delete().eq('id', id);
  if (error) throw error;
};

// --- Set Operations ---

export const createSet = async (setlistId: string, name: string, position: number) => {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("No user");

  const { data: parent } = await supabase
    .from('setlists')
    .select('user_id')
    .eq('id', setlistId)
    .single();
    
  const ownerId = parent ? parent.user_id : user.id;

  const { data, error } = await supabase
    .from('sets')
    .insert({ 
      setlist_id: setlistId, 
      name, 
      position, 
      user_id: ownerId 
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteSet = async (setId: string) => {
  const { error } = await supabase.from('sets').delete().eq('id', setId);
  if (error) throw error;
};

export const addSongToSet = async (setId: string, songId: string, position: number) => {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("No user");

  const { data: parent } = await supabase
    .from('sets')
    .select('user_id')
    .eq('id', setId)
    .single();

  const ownerId = parent ? parent.user_id : user.id;

  const { data, error } = await supabase
    .from('set_songs')
    .insert({ 
      set_id: setId, 
      song_id: songId, 
      position, 
      user_id: ownerId 
    })
    .select(`
      *,
      song:songs(*)
    `)
    .single();
  if (error) throw error;
  return data;
};

export const addSongsToSet = async (setId: string, songIds: string[], startPosition: number) => {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("No user");

  const { data: parent } = await supabase
    .from('sets')
    .select('user_id')
    .eq('id', setId)
    .single();

  const ownerId = parent ? parent.user_id : user.id;

  const rows = songIds.map((songId, index) => ({
    set_id: setId,
    song_id: songId,
    position: startPosition + index,
    user_id: ownerId
  }));

  const { data, error } = await supabase
    .from('set_songs')
    .insert(rows)
    .select();
    
  if (error) throw error;
  return data;
};

export const removeSongFromSet = async (setSongId: string) => {
  const { error } = await supabase.from('set_songs').delete().eq('id', setSongId);
  if (error) throw error;
};

export const updateSetSongOrder = async (items: {id: string, position: number}[]) => {
  // Using Promise.all for parallel execution to improve speed
  await Promise.all(items.map(item => 
    supabase.from('set_songs').update({ position: item.position }).eq('id', item.id)
  ));
};

export const moveSetSongToSet = async (setSongId: string, targetSetId: string, position: number) => {
  const { error } = await supabase
    .from('set_songs')
    .update({ set_id: targetSetId, position })
    .eq('id', setSongId);
    
  if (error) throw error;
};