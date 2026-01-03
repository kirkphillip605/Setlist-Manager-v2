import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Radio, Coffee, ArrowRight } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export const ActiveSessionBanner = () => {
    const { session } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [activeSession, setActiveSession] = useState<{ id: string, gig_id: string, is_on_break: boolean, setlist_id: string } | null>(null);

    useEffect(() => {
        if (!session?.user?.id) return;

        const checkParticipation = async () => {
            // Find active session where user is a participant
            const { data: participantData } = await supabase
                .from('gig_session_participants')
                .select('session_id, gig_sessions(id, gig_id, is_active, is_on_break, gig:gigs(setlist_id))')
                .eq('user_id', session.user.id)
                .maybeSingle();

            // Type assertion to handle complex joined response types
            const pData = participantData as any;

            if (pData?.gig_sessions?.is_active) {
                const gs = pData.gig_sessions;
                setActiveSession({
                    id: gs.id,
                    gig_id: gs.gig_id,
                    is_on_break: gs.is_on_break,
                    setlist_id: gs.gig?.setlist_id
                });
                return;
            }

            // Check leader
            const { data: leaderData } = await supabase
                .from('gig_sessions')
                .select('id, gig_id, is_active, is_on_break, gig:gigs(setlist_id)')
                .eq('leader_id', session.user.id)
                .eq('is_active', true)
                .maybeSingle();
            
            const lData = leaderData as any;
            
            if (lData) {
                setActiveSession({
                    id: lData.id,
                    gig_id: lData.gig_id,
                    is_on_break: lData.is_on_break,
                    setlist_id: lData.gig?.setlist_id
                });
            } else {
                setActiveSession(null);
            }
        };

        checkParticipation();

        const channel = supabase.channel('session_banner_check')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'gig_session_participants', filter: `user_id=eq.${session.user.id}` }, checkParticipation)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gig_sessions' }, checkParticipation)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [session?.user?.id]);

    const isInPerformance = location.pathname.startsWith('/performance') && location.search.includes(activeSession?.gig_id || 'none');

    if (!activeSession || isInPerformance || !activeSession.setlist_id) return null;

    return (
        <div className={cn(
            "fixed bottom-[70px] md:bottom-4 left-4 right-4 z-50 rounded-lg shadow-lg border p-3 flex items-center justify-between animate-in slide-in-from-bottom-5",
            activeSession.is_on_break 
                ? "bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-950/80 dark:border-amber-800 dark:text-amber-100" 
                : "bg-primary text-primary-foreground"
        )}>
            <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-full", activeSession.is_on_break ? "bg-amber-200/50 dark:bg-amber-900" : "bg-white/20")}>
                    {activeSession.is_on_break ? <Coffee className="h-5 w-5" /> : <Radio className="h-5 w-5 animate-pulse" />}
                </div>
                <div className="flex flex-col">
                    <span className="font-bold text-sm">
                        {activeSession.is_on_break ? "Band is on Break" : "Gig in Session"}
                    </span>
                    <span className="text-xs opacity-90">Tap to rejoin performance</span>
                </div>
            </div>
            <Button 
                size="sm" 
                variant={activeSession.is_on_break ? "outline" : "secondary"}
                className={cn("h-8", activeSession.is_on_break && "border-amber-500 hover:bg-amber-200 dark:hover:bg-amber-900")}
                onClick={() => navigate(`/performance/${activeSession.setlist_id}?gigId=${activeSession.gig_id}`)}
            >
                Rejoin <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
        </div>
    );
};