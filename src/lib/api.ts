import { supabase } from "@/integrations/supabase/client";
import { Song, Setlist, Gig, GigSession } from "@/types";

// ... existing code ...

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

export const getSongUsage = async (songId: string): Promise<{ setlistName: string; date?: string }[]> => {
  const { data, error } = await supabase.from('set_songs').select(`sets (setlists (name))`).eq('song_id', songId);
  if (error) throw error;
  const usage: { setlistName: string }[] = [];
  const seen = new Set<string>();
  data.forEach((item: any) => {
    const setlist = item.sets?.setlists;
    if (setlist) {
      if (!seen.has(setlist.name)) {
        seen.add(setlist.name);
        usage.push({ setlistName: setlist.name });
      }
    }
  });
  return usage;
};

// --- Gigs ---

export const getGigs = async (): Promise<Gig[]> => {
  const { data, error } = await supabase
    .from('gigs')
    .select(`*, setlist:setlists(id, name)`)
    .order('date', { ascending: true });
    
  if (error) throw error;
  return data as Gig[];
};

export const getGig = async (id: string): Promise<Gig | null> => {
  const { data, error } = await supabase
    .from('gigs')
    .select(`*, setlist:setlists(id, name)`)
    .eq('id', id)
    .single();

  if (error) return null;
  return data as Gig;
};

export const saveGig = async (gig: Partial<Gig>) => {
    // Check for active session first to prevent edits during show
    if (gig.id) {
        const { data: session } = await supabase.from('gig_sessions').select('id').eq('gig_id', gig.id).single();
        if (session) throw new Error("Cannot edit gig while a performance session is active.");
    }

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error("No user");

    const gigData = {
        name: gig.name,
        date: gig.date,
        notes: gig.notes,
        setlist_id: gig.setlist_id,
        user_id: user.id,
        venue_name: gig.venue_name,
        address: gig.address,
        city: gig.city,
        state: gig.state,
        zip: gig.zip
    };

    if (gig.id) {
        const { data, error } = await supabase.from('gigs').update(gigData).eq('id', gig.id).select().single();
        if (error) throw error;
        return data;
    } else {
        const { data, error } = await supabase.from('gigs').insert(gigData).select().single();
        if (error) throw error;
        return data;
    }
};

export const deleteGig = async (id: string) => {
    // Check for active session
    const { data: session } = await supabase.from('gig_sessions').select('id').eq('gig_id', id).single();
    if (session) throw new Error("Cannot delete gig while a performance session is active.");

    const { error } = await supabase.from('gigs').delete().eq('id', id);
    if (error) throw error;
};

export const addSkippedSong = async (gigId: string, songId: string) => {
    const { error } = await supabase.from('gig_skipped_songs').insert({ gig_id: gigId, song_id: songId });
    if (error) throw error;
};

export const getSkippedSongs = async (gigId: string): Promise<Song[]> => {
    const { data, error } = await supabase
        .from('gig_skipped_songs')
        .select('song:songs(*)')
        .eq('gig_id', gigId)
        .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data.map((d: any) => d.song) as Song[];
};

export const getAllSkippedSongs = async () => {
    const { data, error } = await supabase
        .from('gig_skipped_songs')
        .select('*, song:songs(*)')
        .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data;
};

export const removeSkippedSong = async (gigId: string, songId: string) => {
    const { error } = await supabase.from('gig_skipped_songs').delete().match({ gig_id: gigId, song_id: songId });
    if (error) throw error;
};


// --- Setlists ---

export const getSetlists = async (): Promise<Setlist[]> => {
  const { data, error } = await supabase
    .from('setlists')
    .select(`*, sets (*, set_songs (*, song:songs (*)))`)
    .order('name', { ascending: true });

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

export const getSetlistUsage = async (setlistId: string): Promise<Gig[]> => {
    const { data, error } = await supabase.from('gigs').select('*').eq('setlist_id', setlistId);
    if (error) throw error;
    return data as Gig[];
};

export const createSetlist = async (name: string, isPersonal: boolean = false, isDefault: boolean = false) => {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("No user");

  if (isDefault) {
      await supabase.from('setlists').update({ is_default: false }).eq('is_default', true);
  }

  const { data, error } = await supabase
    .from('setlists')
    .insert({ 
        name, 
        date: new Date().toISOString().split('T')[0], 
        is_tbd: false,
        user_id: user.id, 
        is_personal: isPersonal,
        is_default: isDefault
    })
    .select()
    .single();
    
  if (error) throw error;
  return data;
};

export const updateSetlist = async (id: string, updates: Partial<Setlist>) => {
  // Lock Check: Is this setlist used in an active gig?
  const { data: activeGig } = await supabase.from('gig_sessions')
    .select('gig_id, gigs(setlist_id)')
    .eq('gigs.setlist_id', id)
    .single();
    
  // Note: The above join query might need adjustment depending on how Supabase resolves nested filters on joins.
  // A safer two-step check:
  const { data: gigsUsingSetlist } = await supabase.from('gigs').select('id').eq('setlist_id', id);
  if (gigsUsingSetlist && gigsUsingSetlist.length > 0) {
      const gigIds = gigsUsingSetlist.map(g => g.id);
      const { data: session } = await supabase.from('gig_sessions').select('id').in('gig_id', gigIds).single();
      if (session) throw new Error("Cannot edit setlist while it is being used in an active performance.");
  }

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

export const cloneSetlist = async (sourceId: string, newName: string, isPersonal: boolean) => {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("No user");

  const { data, error } = await supabase.rpc('clone_setlist', {
    source_setlist_id: sourceId,
    new_name: newName,
    new_date: new Date().toISOString().split('T')[0], // Dummy
    is_personal_copy: isPersonal,
    owner_id: user.id
  });

  if (error) throw error;
  return { id: data };
};

export const deleteSetlist = async (id: string) => {
  const { error } = await supabase.from('setlists').delete().eq('id', id);
  if (error) throw error;
};

// --- Set Operations ---

export const createSet = async (setlistId: string, name: string, position: number) => {
  // Check active session lock (reuse logic from updateSetlist ideally, but simple check here)
  const { data: gigs } = await supabase.from('gigs').select('id').eq('setlist_id', setlistId);
  if (gigs && gigs.length > 0) {
      const { data: session } = await supabase.from('gig_sessions').select('id').in('gig_id', gigs.map(g => g.id)).single();
      if (session) throw new Error("Cannot modify sets during active performance.");
  }

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
  const { error } = await supabase.from('sets').delete().eq('id', setId);
  if (error) throw error;

  const { data: remainingSets } = await supabase
    .from('sets')
    .select('id, position')
    .eq('setlist_id', setlistId)
    .order('position');

  if (remainingSets) {
      const updates = remainingSets.map((s, idx) => ({
          id: s.id,
          name: `Set ${idx + 1}`,
          position: idx + 1
      }));

      for (const update of updates) {
          await supabase.from('sets').update({ position: update.position, name: update.name }).eq('id', update.id);
      }
  }
};

export const addSongsToSet = async (setId: string, songIds: string[], startPosition: number) => {
  // Need to find setlist ID first to check locks
  const { data: set } = await supabase.from('sets').select('setlist_id').eq('id', setId).single();
  if (set) {
      const { data: gigs } = await supabase.from('gigs').select('id').eq('setlist_id', set.setlist_id);
      if (gigs && gigs.length > 0) {
          const { data: session } = await supabase.from('gig_sessions').select('id').in('gig_id', gigs.map(g => g.id)).single();
          if (session) throw new Error("Cannot add songs during active performance.");
      }
  }

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

// --- Logs ---
export const getLogs = async () => {
    const { data, error } = await supabase
        .from('activity_logs')
        .select(`*, user:profiles(email, first_name, last_name)`)
        .order('created_at', { ascending: false })
        .limit(100);
        
    if (error) throw error;
    return data;
};

// --- Gig Sessions (Realtime) ---

export const getGigSession = async (gigId: string): Promise<GigSession | null> => {
    const { data, error } = await supabase.from('gig_sessions').select('*').eq('gig_id', gigId).maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
};

export const createGigSession = async (gigId: string, leaderId: string): Promise<GigSession> => {
    const { data, error } = await supabase
        .from('gig_sessions')
        .insert({ gig_id: gigId, leader_id: leaderId })
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const endGigSession = async (sessionId: string) => {
    await supabase.from('gig_sessions').delete().eq('id', sessionId);
};

export const joinGigSession = async (sessionId: string, userId: string) => {
    // Upsert to handle re-joins
    const { error } = await supabase.from('gig_session_participants')
        .upsert({ session_id: sessionId, user_id: userId, last_seen: new Date().toISOString() }, { onConflict: 'session_id,user_id' });
    if (error) throw error;
};

export const sendHeartbeat = async (sessionId: string, userId: string, isLeader: boolean) => {
    // Update participant
    await supabase.from('gig_session_participants')
        .update({ last_seen: new Date().toISOString() })
        .eq('session_id', sessionId)
        .eq('user_id', userId);

    // If leader, update session heartbeat
    if (isLeader) {
        await supabase.from('gig_sessions')
            .update({ last_heartbeat: new Date().toISOString() })
            .eq('id', sessionId);
    }
};

export const updateSessionState = async (sessionId: string, state: { current_set_index?: number, current_song_index?: number, adhoc_song_id?: string | null }) => {
    await supabase.from('gig_sessions').update(state).eq('id', sessionId);
};

export const requestLeadership = async (sessionId: string, userId: string) => {
    await supabase.from('leadership_requests').insert({ session_id: sessionId, requester_id: userId });
};

export const resolveLeadershipRequest = async (requestId: string, status: 'approved' | 'denied') => {
    await supabase.from('leadership_requests').update({ status }).eq('id', requestId);
};

export const forceLeadership = async (sessionId: string, userId: string) => {
    await supabase.from('gig_sessions').update({ leader_id: userId, last_heartbeat: new Date().toISOString() }).eq('id', sessionId);
};