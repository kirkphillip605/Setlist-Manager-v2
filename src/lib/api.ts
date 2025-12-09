import { supabase } from "@/integrations/supabase/client";
import { Song, Setlist, Set as SetType, SetSong } from "@/types";

// --- Types Helper ---
interface SupabaseSetSong {
  id: string;
  position: number;
  song_id: string;
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
  const { data, error } = await supabase.from('songs').select('*').order('title');
  if (error) throw error;
  return data as Song[];
};

export const getSong = async (id: string): Promise<Song | null> => {
  const { data, error } = await supabase.from('songs').select('*').eq('id', id).single();
  if (error) return null;
  return data as Song;
};

export const saveSong = async (song: Partial<Song>) => {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("No user found");

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
    const { data, error } = await supabase.from('songs').update(songData).eq('id', song.id).select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase.from('songs').insert({ ...songData, user_id: user.id }).select().single();
    if (error) throw error;
    return data;
  }
};

export const deleteSong = async (id: string) => {
  const { error } = await supabase.from('songs').delete().eq('id', id);
  if (error) throw error;
};

export const getSongUsage = async (songId: string): Promise<{ setlistName: string; date: string }[]> => {
  const { data, error } = await supabase.from('set_songs').select(`sets (setlists (name, date))`).eq('song_id', songId);
  if (error) throw error;
  const usage: { setlistName: string; date: string }[] = [];
  const seen = new Set<string>();
  data.forEach((item: any) => {
    const setlist = item.sets?.setlists;
    if (setlist) {
      const key = `${setlist.name}-${setlist.date}`;
      if (!seen.has(key)) {
        seen.add(key);
        usage.push({ setlistName: setlist.name, date: setlist.date });
      }
    }
  });
  return usage;
};

// --- Setlists ---

export const getSetlists = async (): Promise<Setlist[]> => {
  const { data, error } = await supabase
    .from('setlists')
    .select(`*, sets (*, set_songs (*, song:songs (*)))`)
    .order('date', { ascending: false });

  if (error) throw error;

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
            songId: ss.song_id,
            song: ss.song || undefined 
          }))
      }))
  }));
};

export const getSetlist = async (id: string): Promise<Setlist | null> => {
  const { data, error } = await supabase
    .from('setlists')
    .select(`*, sets (*, set_songs (*, song:songs (*)))`)
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
            songId: ss.song_id,
            song: ss.song || undefined
          }))
      }))
  };
};

export const createSetlist = async (name: string, date: string, isPersonal: boolean = false, isTbd: boolean = false, isDefault: boolean = false) => {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("No user");

  // If setting default, unset others first (handled better by DB trigger usually, but manual for now)
  if (isDefault) {
      await supabase.from('setlists').update({ is_default: false }).eq('is_default', true);
  }

  const { data, error } = await supabase
    .from('setlists')
    .insert({ 
        name, 
        date, 
        user_id: user.id, 
        is_personal: isPersonal,
        is_tbd: isTbd,
        is_default: isDefault
    })
    .select()
    .single();
    
  if (error) throw error;
  return data;
};

export const updateSetlist = async (id: string, updates: Partial<Setlist>) => {
  if (updates.is_default) {
       await supabase.from('setlists').update({ is_default: false }).eq('is_default', true);
  }

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
  // Fetch the created setlist to get its ID, since RPC might just return ID
  return { id: data };
};

export const deleteSetlist = async (id: string) => {
  const { error } = await supabase.from('setlists').delete().eq('id', id);
  if (error) throw error;
};

// --- Set Operations ---

export const createSet = async (setlistId: string, name: string, position: number) => {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("No user");

  const { data: parent } = await supabase.from('setlists').select('user_id').eq('id', setlistId).single();
  const ownerId = parent ? parent.user_id : user.id;

  const { data, error } = await supabase
    .from('sets')
    .insert({ setlist_id: setlistId, name, position, user_id: ownerId })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteSet = async (setId: string, setlistId: string) => {
  // 1. Delete the set
  const { error } = await supabase.from('sets').delete().eq('id', setId);
  if (error) throw error;

  // 2. Renumber remaining sets
  const { data: remainingSets } = await supabase
    .from('sets')
    .select('id, position')
    .eq('setlist_id', setlistId)
    .order('position');

  if (remainingSets) {
      // Re-write positions strictly 1, 2, 3...
      const updates = remainingSets.map((s, idx) => ({
          id: s.id,
          name: `Set ${idx + 1}`, // Also auto-rename sets to keep them clean
          position: idx + 1
      }));

      for (const update of updates) {
          await supabase.from('sets').update({ position: update.position, name: update.name }).eq('id', update.id);
      }
  }
};

export const addSongToSet = async (setId: string, songId: string, position: number) => {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("No user");

  const { data: parent } = await supabase.from('sets').select('user_id').eq('id', setId).single();
  const ownerId = parent ? parent.user_id : user.id;

  const { data, error } = await supabase
    .from('set_songs')
    .insert({ set_id: setId, song_id: songId, position, user_id: ownerId })
    .select(`*, song:songs(*)`).single();
  if (error) throw error;
  return data;
};

export const addSongsToSet = async (setId: string, songIds: string[], startPosition: number) => {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("No user");

  const { data: parent } = await supabase.from('sets').select('user_id').eq('id', setId).single();
  const ownerId = parent ? parent.user_id : user.id;

  const rows = songIds.map((songId, index) => ({
    set_id: setId,
    song_id: songId,
    position: startPosition + index,
    user_id: ownerId
  }));

  const { data, error } = await supabase.from('set_songs').insert(rows).select();
  if (error) throw error;
  return data;
};

export const removeSongFromSet = async (setSongId: string) => {
  const { error } = await supabase.from('set_songs').delete().eq('id', setSongId);
  if (error) throw error;
};

export const updateSetSongOrder = async (items: {id: string, position: number}[]) => {
  await Promise.all(items.map(item => 
    supabase.from('set_songs').update({ position: item.position }).eq('id', item.id)
  ));
};

export const moveSetSongToSet = async (setSongId: string, targetSetId: string, position: number) => {
  const { error } = await supabase.from('set_songs').update({ set_id: targetSetId, position }).eq('id', setSongId);
  if (error) throw error;
};