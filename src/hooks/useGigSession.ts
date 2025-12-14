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
    
    // Heartbeat Ref to avoid closure staleness
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
                // Fetch initial participants
                const { data: parts } = await supabase
                    .from('gig_session_participants')
                    .select('*, profile:profiles(first_name, last_name, position)')
                    .eq('session_id', data.id);
                if (parts) setParticipants(parts);
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
                        toast.info("Performance session ended.");
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
                    // Only care if we are the current leader and the request is for our session
                    if (sessionDataRef.current?.leader_id === authSession.user.id && payload.new.session_id === sessionDataRef.current?.id) {
                       // Logic handled in component, but we could trigger toast here
                    }
                }
            )
            .subscribe();

        // Separate subscription for Participants (to handle the relation join, we usually re-fetch on change)
        const partChannel = supabase.channel(`gig_participants:${gigId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'gig_session_participants' },
                async (payload) => {
                    // Simple approach: Refetch full list to get profile relations
                    // We only do this if we have a session ID
                    if (sessionDataRef.current?.id) {
                         const { data: parts } = await supabase
                            .from('gig_session_participants')
                            .select('*, profile:profiles(first_name, last_name, position)')
                            .eq('session_id', sessionDataRef.current.id);
                        if (parts) setParticipants(parts);
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
    }, [gigId, authSession?.user?.id]); // Minimal dependency array to avoid reconnection loops

    return { 
        sessionData, 
        participants, 
        loading, 
        isLeader,
        userId: authSession?.user?.id
    };
};