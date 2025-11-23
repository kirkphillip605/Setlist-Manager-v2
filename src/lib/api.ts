import { supabase } from "@/integrations/supabase/client";
import { Song, Setlist } from "@/types";

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

  const songData = {
    title: song.title,
    artist: song.artist,
    lyrics: song.lyrics,
    key: song.key,
    tempo: song.tempo,
    duration: song.duration,
    note: song.note,
    cover_url: song.cover_url,
    spotify_url: song.spotify_url,
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
        user_id: user.id,
        // Ensure undefined fields are not passed as undefined if they are optional in DB but we want null
        cover_url: song.cover_url || null,
        spotify_url: song.spotify_url || null
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

// --- Setlists ---

export const getSetlists = async (): Promise<Setlist[]> => {
  const { data: setlists, error } = await supabase
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

  // Use any to bypass type mismatch between DB response (set_songs) and App Type (songs)
  return (setlists as any[]).map(list => ({
    ...list,
    sets: list.sets
      .sort((a: any, b: any) => a.position - b.position)
      .map((set: any) => ({
        ...set,
        songs: set.set_songs
          .sort((a: any, b: any) => a.position - b.position)
          .map((ss: any) => ({
            ...ss,
            songId: ss.song_id,
            song: ss.song
          }))
      }))
  })) as Setlist[];
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

  const list = data as any;
  return {
    ...list,
    sets: list.sets
      .sort((a: any, b: any) => a.position - b.position)
      .map((set: any) => ({
        ...set,
        songs: set.set_songs
          .sort((a: any, b: any) => a.position - b.position)
          .map((ss: any) => ({
            ...ss,
            songId: ss.song_id,
            song: ss.song
          }))
      }))
  };
};

export const createSetlist = async (name: string, date: string) => {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("No user");

  const { data, error } = await supabase
    .from('setlists')
    .insert({ name, date, user_id: user.id })
    .select()
    .single();
    
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

export const removeSongFromSet = async (setSongId: string) => {
  const { error } = await supabase.from('set_songs').delete().eq('id', setSongId);
  if (error) throw error;
};

export const updateSetSongOrder = async (items: {id: string, position: number}[]) => {
  for (const item of items) {
    await supabase.from('set_songs').update({ position: item.position }).eq('id', item.id);
  }
};