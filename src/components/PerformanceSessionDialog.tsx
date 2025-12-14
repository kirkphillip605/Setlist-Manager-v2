import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Users, Crown, Radio, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { createGigSession, getGigSession, joinGigSession } from "@/lib/api";
import { toast } from "sonner";

interface PerformanceSessionDialogProps {
    open: boolean;
    gigId: string | null;
    gigName: string;
    onClose: () => void;
    onJoin: (mode: "leader" | "follower" | "standalone", sessionId: string) => void;
}

export const PerformanceSessionDialog = ({ open, gigId, gigName, onClose, onJoin }: PerformanceSessionDialogProps) => {
    const { session: authSession } = useAuth();
    const [loading, setLoading] = useState(true);
    const [existingSession, setExistingSession] = useState<any>(null);
    const [leaderName, setLeaderName] = useState<string>("");

    useEffect(() => {
        if (open && gigId) {
            checkSession();
        }
    }, [open, gigId]);

    const checkSession = async () => {
        setLoading(true);
        try {
            const session = await getGigSession(gigId!);
            if (session) {
                setExistingSession(session);
                // Fetch leader name
                const { data: profile } = await supabase.from('profiles').select('first_name, last_name').eq('id', session.leader_id).single();
                if (profile) setLeaderName(`${profile.first_name} ${profile.last_name}`);
            } else {
                setExistingSession(null);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleStartAsLeader = async () => {
        if (!authSession?.user || !gigId) return;
        setLoading(true);
        try {
            let sessionId;
            if (existingSession) {
                sessionId = existingSession.id;
            } else {
                const newSession = await createGigSession(gigId, authSession.user.id);
                sessionId = newSession.id;
            }
            
            await joinGigSession(sessionId, authSession.user.id);
            onJoin("leader", sessionId);
        } catch (e: any) {
            toast.error("Failed to start session: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleJoinAsFollower = async () => {
        if (!authSession?.user || !existingSession) return;
        setLoading(true);
        try {
            await joinGigSession(existingSession.id, authSession.user.id);
            onJoin("follower", existingSession.id);
        } catch (e: any) {
            toast.error("Failed to join session: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleStandalone = () => {
        onJoin("standalone", "");
    };

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Start Performance: {gigName}</DialogTitle>
                    <DialogDescription>
                        Sync your screen with the band for this gig.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : (
                    <div className="space-y-4 py-4">
                        {existingSession ? (
                            <div className="bg-secondary/20 p-4 rounded-lg border border-secondary flex flex-col items-center text-center gap-2">
                                <Radio className="h-8 w-8 text-green-500 animate-pulse" />
                                <div className="font-medium text-lg">Session in Progress</div>
                                <div className="text-sm text-muted-foreground">
                                    Leader: <span className="font-bold text-foreground">{leaderName || "Unknown"}</span>
                                </div>
                                <Button className="w-full mt-2" onClick={handleJoinAsFollower}>
                                    <Users className="mr-2 h-4 w-4" /> Join as Follower
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="text-sm text-center text-muted-foreground mb-4">
                                    No active session found. You can start one as the leader.
                                </div>
                                <Button className="w-full" onClick={handleStartAsLeader}>
                                    <Crown className="mr-2 h-4 w-4" /> Start as Leader
                                </Button>
                            </div>
                        )}

                        <div className="relative my-4">
                            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                            <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or</span></div>
                        </div>

                        <Button variant="outline" className="w-full" onClick={handleStandalone}>
                            <Smartphone className="mr-2 h-4 w-4" /> Standalone Mode
                        </Button>
                    </div>
                )}
                
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};