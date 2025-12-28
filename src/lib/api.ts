import { supabase } from "@/integrations/supabase/client";
import { Song, Setlist, Gig, GigSession, Set as SetType, SetSong } from "@/types";

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
  const { data: { user } } = await supabase.auth.getUser();
  
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
    ...(song.id ? {} : { created_by: user?.id })
  };

  if (song.id) {
    const { data, error } = await supabase.from('songs').update(songData).eq('id', song.id).select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase.from('songs').insert(songData).select().single();
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
    .order('start_time', { ascending: true });
    
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
    const { data: { user } } = await supabase.auth.getUser();

    // Validation: Check for active session if editing
    if (gig.id) {
        const { data: session } = await supabase.from('gig_sessions').select('id').eq('gig_id', gig.id).eq('is_active', true).maybeSingle();
        if (session) throw new Error("Cannot edit gig while a performance session is active.");
    }

    if (!gig.start_time) throw new Error("Start time is required");

    const gigData = {
        name: gig.name,
        start_time: gig.start_time,
        end_time: gig.end_time,
        notes: gig.notes,
        setlist_id: gig.setlist_id,
        venue_name: gig.venue_name,
        address: gig.address,
        city: gig.city,
        state: gig.state,
        zip: gig.zip,
        // Only set created_by on insert
        ...(gig.id ? {} : { created_by: user?.id })
    };

    if (gig.id) {
        const { data, error } = await supabase.from('gigs').update(gigData).eq('id', gig.id).select().single();
        if (error) {
            console.error("Update Gig Error:", error);
            throw new Error(error.message || "Failed to update gig");
        }
        return data;
    } else {
        const { data, error } = await supabase.from('gigs').insert(gigData).select().single();
        if (error) {
            console.error("Insert Gig Error:", error);
            throw new Error(error.message || "Failed to create gig");
        }
        return data;
    }
};

export const deleteGig = async (id: string) => {
    const { data: session } = await supabase.from('gig_sessions').select('id').eq('gig_id', id).eq('is_active', true).maybeSingle();
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
        created_by: undefined,
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
  const { data: { user } } = await supabase.auth.getUser();
  
  if (isDefault) {
      await supabase.from('setlists').update({ is_default: false }).eq('is_default', true);
  }

  // NOTE: 'date' column in setlists is still text based on schema in context, 
  // but let's send ISO string just in case.
  const { data, error } = await supabase
    .from('setlists')
    .insert({ 
        name, 
        date: new Date().toISOString().split('T')[0], 
        is_tbd: false,
        created_by: user?.id,
        is_personal: isPersonal,
        is_default: isDefault
    })
    .select()
    .single();
    
  if (error) throw error;
  return data;
};

export const updateSetlist = async (id: string, updates: Partial<Setlist>) => {
  const { data: gigsUsingSetlist } = await supabase.from('gigs').select('id').eq('setlist_id', id);
  if (gigsUsingSetlist && gigsUsingSetlist.length > 0) {
      const gigIds = gigsUsingSetlist.map(g => g.id);
      const { data: session } = await supabase.from('gig_sessions').select('id').in('gig_id', gigIds).eq('is_active', true).maybeSingle();
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

// --- Sync Logic ---

export const syncSetlist = async (setlist: Setlist) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // 1. Update Metadata
    await supabase.from('setlists').update({ name: setlist.name }).eq('id', setlist.id);

    // --- Sets Handling ---
    const { data: dbSets } = await supabase.from('sets').select('id').eq('setlist_id', setlist.id);
    const existingSetIds = new Set(dbSets?.map(s => s.id) || []);
    const incomingSetIds = new Set(setlist.sets.filter(s => !s.id.startsWith('temp-')).map(s => s.id));
    
    // 1.1 Delete Sets
    const setsToDelete = [...existingSetIds].filter(id => !incomingSetIds.has(id));
    if (setsToDelete.length > 0) {
        await supabase.from('sets').delete().in('id', setsToDelete);
    }

    // 1.2 Update Existing Sets
    const setsToUpdate = setlist.sets
        .filter(s => !s.id.startsWith('temp-'))
        .map(s => ({
            id: s.id,
            name: s.name,
            position: s.position,
            setlist_id: setlist.id 
        }));
    
    if (setsToUpdate.length > 0) {
        const { error } = await supabase.from('sets').upsert(setsToUpdate);
        if (error) throw error;
    }

    // 1.3 Insert New Sets (Capture new IDs)
    const setsToInsert = setlist.sets.filter(s => s.id.startsWith('temp-'));
    const tempSetIdMap: Record<string, string> = {};

    for (const set of setsToInsert) {
        const { data, error } = await supabase.from('sets').insert({
            name: set.name,
            position: set.position,
            setlist_id: setlist.id,
            created_by: user?.id
        }).select('id').single();
        
        if (error) throw error;
        tempSetIdMap[set.id] = data.id;
    }

    // --- Songs Handling ---
    // Identify valid Set IDs (Existing + New) to scope the deletions correctly
    const validSetIds = [
        ...setsToUpdate.map(s => s.id),
        ...Object.values(tempSetIdMap)
    ];

    const { data: dbSongs } = await supabase.from('set_songs').select('id').in('set_id', validSetIds);
    const existingSongIds = new Set(dbSongs?.map(s => s.id) || []);
    
    const incomingSongIds = new Set<string>();
    const songsToUpdate: any[] = [];
    const songsToInsert: any[] = [];

    setlist.sets.forEach(set => {
        const realSetId = set.id.startsWith('temp-') ? tempSetIdMap[set.id] : set.id;
        
        set.songs.forEach(song => {
            if (!song.id.startsWith('temp-')) {
                incomingSongIds.add(song.id);
                // Update
                songsToUpdate.push({
                    id: song.id,
                    set_id: realSetId,
                    song_id: song.songId,
                    position: song.position
                });
            } else {
                // Insert
                songsToInsert.push({
                    set_id: realSetId,
                    song_id: song.songId,
                    position: song.position,
                    created_by: user?.id
                });
            }
        });
    });

    // 2.1 Delete Removed Songs
    const songsToDelete = [...existingSongIds].filter(id => !incomingSongIds.has(id));
    if (songsToDelete.length > 0) {
        await supabase.from('set_songs').delete().in('id', songsToDelete);
    }

    // 2.2 Update Existing Songs (Safe Reordering)
    // To avoid "duplicate key value violates unique constraint" on (set_id, position):
    // We first move all updated items to a temporary high position, then to their final position.
    if (songsToUpdate.length > 0) {
        // Step A: Move to temp position (current + 10000) to clear the board
        const tempUpdates = songsToUpdate.map(s => ({ ...s, position: s.position + 10000 }));
        const { error: tempError } = await supabase.from('set_songs').upsert(tempUpdates);
        if (tempError) throw tempError;

        // Step B: Move to actual position
        const { error: finalError } = await supabase.from('set_songs').upsert(songsToUpdate);
        if (finalError) throw finalError;
    }

    // 2.3 Insert New Songs
    // We rely on simple INSERT here, NOT upsert, so we don't pass 'id' at all.
    // This solves "null value in column id" error.
    if (songsToInsert.length > 0) {
        const { error } = await supabase.from('set_songs').insert(songsToInsert);
        if (error) throw error;
    }
};

export const convertSetlistToBand = async (id: string) => {
    const { error } = await supabase.from('setlists').update({ is_personal: false }).eq('id', id);
    if (error) throw error;
};

export const cloneSetlist = async (sourceId: string, newName: string, isPersonal: boolean) => {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("No user");

  // Clone Setlist Function might need updates in DB if it explicitly inserts user_id
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

// --- Legacy Set Operations ---

export const createSet = async (setlistId: string, name: string, position: number) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data: gigs } = await supabase.from('gigs').select('id').eq('setlist_id', setlistId);
  if (gigs && gigs.length > 0) {
      const { data: session } = await supabase.from('gig_sessions').select('id').in('gig_id', gigs.map(g => g.id)).eq('is_active', true).maybeSingle();
      if (session) throw new Error("Cannot modify sets during active performance.");
  }

  const { data, error } = await supabase
    .from('sets')
    .insert({ setlist_id: setlistId, name, position, created_by: user?.id })
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
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data: set } = await supabase.from('sets').select('setlist_id').eq('id', setId).single();
  if (set) {
      const { data: gigs } = await supabase.from('gigs').select('id').eq('setlist_id', set.setlist_id);
      if (gigs && gigs.length > 0) {
          const { data: session } = await supabase.from('gig_sessions').select('id').in('gig_id', gigs.map(g => g.id)).eq('is_active', true).maybeSingle();
          if (session) throw new Error("Cannot add songs during active performance.");
      }
  }

  const rows = songIds.map((songId, index) => ({
    set_id: setId,
    song_id: songId,
    position: startPosition + index,
    created_by: user?.id
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

// --- Gig Sessions ---

export const getGigSession = async (gigId: string): Promise<GigSession | null> => {
    const { data, error } = await supabase.from('gig_sessions').select('*').eq('gig_id', gigId).maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
};

export const getAllGigSessions = async () => {
    const { data, error } = await supabase
        .from('gig_sessions')
        .select(`
            *, 
            gig:gigs(name), 
            leader:profiles!gig_sessions_leader_id_fkey(first_name, last_name),
            participants:gig_session_participants(
                profile:profiles(first_name, last_name)
            )
        `)
        .eq('is_active', true)
        .order('started_at', { ascending: false });
    
    if (error) throw error;
    return data;
};

export const createGigSession = async (gigId: string, leaderId: string): Promise<GigSession> => {
    const { data: existing } = await supabase.from('gig_sessions').select('*').eq('gig_id', gigId);
    
    if (existing && existing.length > 0) {
        const active = existing.find(s => s.is_active);
        if (active) {
             throw new Error("Active session already exists");
        } else {
            const idsToDelete = existing.map(s => s.id);
            await supabase.from('gig_sessions').delete().in('id', idsToDelete);
        }
    }

    const { data, error } = await supabase
        .from('gig_sessions')
        .insert({ gig_id: gigId, leader_id: leaderId })
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const endGigSession = async (sessionId: string) => {
    await supabase.from('gig_sessions').update({ is_active: false, ended_at: new Date().toISOString() }).eq('id', sessionId);
};

export const endAllSessions = async () => {
    await supabase.from('gig_sessions').update({ is_active: false, ended_at: new Date().toISOString() }).neq('id', '00000000-0000-0000-0000-000000000000');
};

export const cleanupStaleSessions = async () => {
    await supabase.rpc('cleanup_stale_gig_sessions');
};

export const joinGigSession = async (sessionId: string, userId: string) => {
    const { error } = await supabase.from('gig_session_participants')
        .upsert({ session_id: sessionId, user_id: userId, last_seen: new Date().toISOString() }, { onConflict: 'session_id,user_id' });
    if (error) throw error;
};

export const leaveGigSession = async (sessionId: string, userId: string) => {
    const { error } = await supabase.from('gig_session_participants')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', userId);
    if (error) throw error;
};

export const sendHeartbeat = async (sessionId: string, userId: string, isLeader: boolean) => {
    await supabase.from('gig_session_participants')
        .update({ last_seen: new Date().toISOString() })
        .eq('session_id', sessionId)
        .eq('user_id', userId);

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