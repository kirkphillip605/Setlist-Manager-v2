import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GigSession, GigSessionParticipant } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { sendHeartbeat } from "@/lib/api";
import { toast } from "sonner";

export const useGigSession = (gigId: string | null) => {
    const { session: authSession } = useAuth();
    const [sessionData, setSessionData] = useState<GigSession | null>(null);
    const [participants, setParticipants] = useState<GigSessionParticipant[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Refs for comparison
    const participantsRef = useRef<GigSessionParticipant[]>([]);
    const sessionDataRef = useRef<GigSession | null>(null);
    
    useEffect(() => { sessionDataRef.current = sessionData; }, [sessionData]);

    const isLeader = !!(authSession?.user?.id && sessionData?.leader_id === authSession.user.id);

    useEffect(() => {
        if (!gigId || !authSession?.user) {
            setLoading(false);
            return;
        }

        // 1. Initial Fetch
        const fetchSession = async () => {
            const { data } = await supabase.from('gig_sessions').select('*').eq('gig_id', gigId).maybeSingle();
            if (data) {
                setSessionData(data);
                const { data: parts } = await supabase
                    .from('gig_session_participants')
                    .select('*, profile:profiles(first_name, last_name, position)')
                    .eq('session_id', data.id);
                if (parts) {
                    setParticipants(parts);
                    participantsRef.current = parts;
                }
            }
            setLoading(false);
        };
        fetchSession();

        // 2. Realtime Subscriptions
        const channel = supabase.channel(`gig_session:${gigId}`)
            // Listen for Session Updates (State changes)
            .on(
                'postgres_changes', 
                { event: '*', schema: 'public', table: 'gig_sessions', filter: `gig_id=eq.${gigId}` },
                (payload) => {
                    if (payload.eventType === 'DELETE') {
                        setSessionData(null);
                        // Handled in component
                    } else {
                        setSessionData(payload.new as GigSession);
                    }
                }
            )
            // Listen for Leadership Requests (For Leader)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'leadership_requests' },
                async (payload) => {
                    if (sessionDataRef.current?.leader_id === authSession.user.id && payload.new.session_id === sessionDataRef.current?.id) {
                       // Logic handled in component
                    }
                }
            )
            .subscribe();

        // Separate subscription for Participants
        const partChannel = supabase.channel(`gig_participants:${gigId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'gig_session_participants' },
                async (payload) => {
                    if (sessionDataRef.current?.id) {
                         const { data: parts } = await supabase
                            .from('gig_session_participants')
                            .select('*, profile:profiles(first_name, last_name, position)')
                            .eq('session_id', sessionDataRef.current.id);
                        
                        if (parts) {
                            // Detect Changes for Toasts
                            const prevIds = new Set(participantsRef.current.map(p => p.user_id));
                            const currIds = new Set(parts.map(p => p.user_id));

                            // Joined?
                            parts.forEach(p => {
                                if (!prevIds.has(p.user_id) && p.user_id !== authSession.user.id) {
                                    toast.info(`${p.profile?.first_name || 'A user'} joined the session.`);
                                }
                            });

                            // Left? (Only if not just a heartbeat update which wouldn't change IDs)
                            // Note: We don't really detect "leaves" via realtime DELETE usually unless explicit. 
                            // But if we did, we could compare here.
                            
                            setParticipants(parts);
                            participantsRef.current = parts;
                        }
                    }
                }
            )
            .subscribe();

        // 3. Heartbeat Interval (Every 10s)
        const interval = setInterval(() => {
            if (sessionDataRef.current && authSession.user) {
                const isCurrentLeader = sessionDataRef.current.leader_id === authSession.user.id;
                sendHeartbeat(sessionDataRef.current.id, authSession.user.id, isCurrentLeader);
            }
        }, 10000);

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(partChannel);
            clearInterval(interval);
        };
    }, [gigId, authSession?.user?.id]);

    return { 
        sessionData, 
        participants, 
        loading, 
        isLeader,
        userId: authSession?.user?.id
    };
};