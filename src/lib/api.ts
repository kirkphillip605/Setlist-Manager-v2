import { supabase } from "@/integrations/supabase/client";
import { Song, Setlist, Set as SetType, SetSong } from "@/types";

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
    ...song,
    user_id: user.id
  };

  // If it has an ID, upsert. Otherwise insert.
  // We remove 'id' if it's new/empty to let Postgres generate it if needed, 
  // but if we generated a UUID client-side, we keep it.
  const { data, error } = await supabase
    .from('songs')
    .upsert(songData)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteSong = async (id: string) => {
  const { error } = await supabase.from('songs').delete().eq('id', id);
  if (error) throw error;
};

// --- Setlists ---

export const getSetlists = async (): Promise<Setlist[]> => {
  // We fetch setlists, then we need to fetch their sets and songs.
  // Supabase JOIN syntax can get deep.
  
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

  // We need to sort the nested arrays manually because Supabase 
  // nested ordering is limited in the JS client without specific syntax.
  const typedSetlists = setlists as unknown as Setlist[];
  
  return typedSetlists.map(list => ({
    ...list,
    sets: list.sets
      .sort((a, b) => a.position - b.position)
      .map(set => ({
        ...set,
        songs: set.set_songs
          .sort((a, b) => a.position - b.position)
          .map(ss => ({
            ...ss,
            songId: ss.song_id, // Map snake_case from DB to camelCase for app types if needed, or update types.
            // Note: Our types use songId, but DB returns song_id. We might need to adjust types or mapping.
            // Let's assume we map it here.
            song: ss.song
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

  // Manual sorting/mapping similar to getSetlists
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

// --- Set Operations (Granular updates instead of full object save) ---

export const createSet = async (setlistId: string, name: string, position: number) => {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("No user");

  const { data, error } = await supabase
    .from('sets')
    .insert({ setlist_id: setlistId, name, position, user_id: user.id })
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

  const { data, error } = await supabase
    .from('set_songs')
    .insert({ set_id: setId, song_id: songId, position, user_id: user.id })
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
  // Helper to batch update positions
  for (const item of items) {
    await supabase.from('set_songs').update({ position: item.position }).eq('id', item.id);
  }
};