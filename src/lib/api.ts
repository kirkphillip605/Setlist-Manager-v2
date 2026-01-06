import { supabase } from "@/integrations/supabase/client";
import { Song, Setlist, Gig, GigSession, Set as SetType, SetSong } from "@/types";

// --- Delta Sync Helper ---

export const fetchDeltas = async (table: string, lastVersion: number) => {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .gt('version', lastVersion)
    .order('version', { ascending: true });

  if (error) throw error;
  return data;
};

export const getCurrentGlobalVersion = async (): Promise<number> => {
  const { data, error } = await supabase.rpc('get_current_global_version');
  if (error) {
      console.warn("Failed to get global version, defaulting to fetch-all strategy", error);
      return Number.MAX_SAFE_INTEGER; // Force sync if check fails
  }
  return data as number;
};

// --- Songs ---

export const getSongs = async (): Promise<Song[]> => {
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .is('deleted_at', null)
    .order('title');
  if (error) throw error;
  return data as Song[];
};

export const getSong = async (id: string): Promise<Song | null> => {
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
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
  const { data: { user } } = await supabase.auth.getUser();
  // Soft delete
  const { error } = await supabase
    .from('songs')
    .update({ 
      deleted_at: new Date().toISOString(),
      deleted_by: user?.id 
    })
    .eq('id', id);
  if (error) throw error;
};

export const getSongUsage = async (songId: string): Promise<{ setlistName: string; date?: string }[]> => {
  // Check active (non-deleted) usage
  const { data, error } = await supabase
    .from('set_songs')
    .select(`sets (setlists (name))`)
    .eq('song_id', songId)
    .is('deleted_at', null); // Only check active links

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
    .is('deleted_at', null)
    .order('start_time', { ascending: true });
    
  if (error) throw error;
  return data as Gig[];
};

export const getGig = async (id: string): Promise<Gig | null> => {
  const { data, error } = await supabase
    .from('gigs')
    .select(`*, setlist:setlists(id, name)`)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) return null;
  return data as Gig;
};

export const saveGig = async (gig: Partial<Gig>) => {
    const { data: { user } } = await supabase.auth.getUser();

    // Validation: Check for active session if editing
    if (gig.id) {
        const { data: session } = await supabase
            .from('gig_sessions')
            .select('id')
            .eq('gig_id', gig.id)
            .eq('is_active', true)
            .is('deleted_at', null)
            .maybeSingle();
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
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: session } = await supabase
        .from('gig_sessions')
        .select('id')
        .eq('gig_id', id)
        .eq('is_active', true)
        .is('deleted_at', null)
        .maybeSingle();
        
    if (session) throw new Error("Cannot delete gig while a performance session is active.");

    // Soft delete
    const { error } = await supabase
        .from('gigs')
        .update({ 
            deleted_at: new Date().toISOString(),
            deleted_by: user?.id 
        })
        .eq('id', id);
        
    if (error) throw error;
};

export const searchVenues = async (query: string) => {
    const { data, error } = await supabase.functions.invoke('search-venue', {
        body: { query }
    });
    
    if (error) throw error;
    return data?.items || [];
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

// Note: This full fetch might be redundant with SyncEngine, but kept for non-synced fallbacks or admin views
export const getSetlists = async (): Promise<Setlist[]> => {
  const { data, error } = await supabase
    .from('setlists')
    .select(`*, sets (*, set_songs (*, song:songs (*)))`)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error) throw error;

  // Filter nested soft-deleted items (Postgrest filtering on nested resources isn't as clean for 'deleted_at is null' inside arrays without explicit filters in the select string, but cascading triggers should handle consistency. 
  // However, strict read requirement says we must filter. 
  // We can add filtering here in JS to be safe, or improve the select query.
  // Using JS filter for complex nested structures is safer for now.
  
  const rawSetlists = data as any[];

  return rawSetlists.map(list => ({
    ...list,
    sets: list.sets
      .filter((s: any) => !s.deleted_at) // Filter deleted sets
      .sort((a: any, b: any) => a.position - b.position)
      .map((set: any) => ({
        id: set.id,
        name: set.name,
        position: set.position,
        created_by: undefined,
        songs: set.set_songs
          .filter((ss: any) => !ss.deleted_at) // Filter deleted set_songs
          .sort((a: any, b: any) => a.position - b.position)
          .map((ss: any) => ({
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
    .is('deleted_at', null)
    .single();

  if (error) return null;
  const list = data as any;

  return {
    ...list,
    sets: list.sets
      .filter((s: any) => !s.deleted_at)
      .sort((a: any, b: any) => a.position - b.position)
      .map((set: any) => ({
        id: set.id,
        name: set.name,
        position: set.position,
        songs: set.set_songs
          .filter((ss: any) => !ss.deleted_at)
          .sort((a: any, b: any) => a.position - b.position)
          .map((ss: any) => ({
            id: ss.id,
            position: ss.position,
            songId: ss.song_id,
            song: ss.song || undefined
          }))
      }))
  };
};

export const getSetlistUsage = async (setlistId: string): Promise<Gig[]> => {
    const { data, error } = await supabase
        .from('gigs')
        .select('*')
        .eq('setlist_id', setlistId)
        .is('deleted_at', null);
    if (error) throw error;
    return data as Gig[];
};

export const createSetlist = async (name: string, isPersonal: boolean = false, isDefault: boolean = false) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (isDefault) {
      await supabase.from('setlists').update({ is_default: false }).eq('is_default', true);
  }

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
  const { data: gigsUsingSetlist } = await supabase
    .from('gigs')
    .select('id')
    .eq('setlist_id', id)
    .is('deleted_at', null);

  if (gigsUsingSetlist && gigsUsingSetlist.length > 0) {
      const gigIds = gigsUsingSetlist.map(g => g.id);
      const { data: session } = await supabase
        .from('gig_sessions')
        .select('id')
        .in('gig_id', gigIds)
        .eq('is_active', true)
        .maybeSingle();
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

// --- Sync Logic (Legacy/Transaction for Setlist Editor) ---
// This handles the complex setlist structure save. 
// We need to ensure deletes here are also soft deletes.

export const syncSetlist = async (setlist: Setlist) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // 1. Update Metadata
    await supabase.from('setlists').update({ name: setlist.name }).eq('id', setlist.id);

    // --- Sets Handling ---
    const { data: dbSets } = await supabase
        .from('sets')
        .select('id')
        .eq('setlist_id', setlist.id)
        .is('deleted_at', null); // Look at active sets

    const existingSetIds = new Set(dbSets?.map(s => s.id) || []);
    const incomingSetIds = new Set(setlist.sets.filter(s => !s.id.startsWith('temp-')).map(s => s.id));
    
    // 1.1 Delete Sets (Soft Delete)
    const setsToDelete = [...existingSetIds].filter(id => !incomingSetIds.has(id));
    if (setsToDelete.length > 0) {
        await supabase.from('sets').update({
            deleted_at: new Date().toISOString(),
            deleted_by: user?.id
        }).in('id', setsToDelete);
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

    // 1.3 Insert New Sets
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
    const validSetIds = [
        ...setsToUpdate.map(s => s.id),
        ...Object.values(tempSetIdMap)
    ];

    const { data: dbSongs } = await supabase
        .from('set_songs')
        .select('id')
        .in('set_id', validSetIds)
        .is('deleted_at', null);

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

    // 2.1 Delete Removed Songs (Soft Delete)
    const songsToDelete = [...existingSongIds].filter(id => !incomingSongIds.has(id));
    if (songsToDelete.length > 0) {
        await supabase.from('set_songs').update({
            deleted_at: new Date().toISOString(),
            deleted_by: user?.id
        }).in('id', songsToDelete);
    }

    // 2.2 Update Existing Songs
    if (songsToUpdate.length > 0) {
        const tempUpdates = songsToUpdate.map(s => ({ ...s, position: s.position + 10000 }));
        await supabase.from('set_songs').upsert(tempUpdates);
        const { error: finalError } = await supabase.from('set_songs').upsert(songsToUpdate);
        if (finalError) throw finalError;
    }

    // 2.3 Insert New Songs
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

  const { data, error } = await supabase.rpc('clone_setlist', {
    source_setlist_id: sourceId,
    new_name: newName,
    new_date: new Date().toISOString().split('T')[0],
    is_personal_copy: isPersonal,
    owner_id: user.id
  });

  if (error) throw error;
  return { id: data };
};

export const deleteSetlist = async (id: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  // Soft Delete
  const { error } = await supabase
    .from('setlists')
    .update({ 
        deleted_at: new Date().toISOString(),
        deleted_by: user?.id
    })
    .eq('id', id);
  if (error) throw error;
};

// --- Gig Sessions ---

export const getGigSession = async (gigId: string): Promise<GigSession | null> => {
    const { data, error } = await supabase
        .from('gig_sessions')
        .select('*')
        .eq('gig_id', gigId)
        .is('deleted_at', null)
        .maybeSingle();
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
        .is('deleted_at', null)
        .order('started_at', { ascending: false });
    
    if (error) throw error;
    return data;
};

export const createGigSession = async (gigId: string, leaderId: string): Promise<GigSession> => {
    const { data: existing } = await supabase
        .from('gig_sessions')
        .select('*')
        .eq('gig_id', gigId)
        .is('deleted_at', null);
    
    if (existing && existing.length > 0) {
        const active = existing.find(s => s.is_active);
        if (active) {
             throw new Error("Active session already exists");
        } else {
            // Soft delete old inactive sessions just to be clean, though they are already inactive
            const idsToDelete = existing.map(s => s.id);
            await supabase.from('gig_sessions').update({ deleted_at: new Date().toISOString() }).in('id', idsToDelete);
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
    await supabase.from('gig_sessions').update({ is_active: false, is_on_break: false, ended_at: new Date().toISOString() }).eq('id', sessionId);
};

export const endAllSessions = async () => {
    // Admin only function, likely doesn't need soft delete logic change, just updates status
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
    // For participants, hard delete is acceptable as it's a join table without version history usually needed,
    // BUT we should stick to soft delete if schema supports it.
    // The schema provided for `gig_session_participants` includes `deleted_at`.
    const { error } = await supabase.from('gig_session_participants')
        .update({ deleted_at: new Date().toISOString() })
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

export const updateSessionState = async (sessionId: string, state: { current_set_index?: number, current_song_index?: number, adhoc_song_id?: string | null, is_on_break?: boolean }) => {
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