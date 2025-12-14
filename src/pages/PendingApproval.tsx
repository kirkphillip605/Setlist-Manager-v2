import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldAlert, Loader2, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PendingApproval = () => {
  const { profile, refreshProfile, signOut, session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session?.user?.id) return;

    // 1. Setup Realtime Listener
    const channel = supabase
        .channel('profile_approval')
        .on(
            'postgres_changes',
            { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'profiles', 
                filter: `id=eq.${session.user.id}` 
            },
            (payload) => {
                if (payload.new.is_approved === true) {
                    refreshProfile(); // Update context
                    navigate("/");    // Redirect immediately
                }
            }
        )
        .subscribe();

    // 2. Poll as Failsafe (60s)
    const interval = setInterval(() => {
        refreshProfile();
    }, 60000);

    return () => {
        supabase.removeChannel(channel);
        clearInterval(interval);
    };
  }, [session?.user?.id, refreshProfile, navigate]);

  useEffect(() => {
      if (profile?.is_approved) {
          navigate("/");
      }
  }, [profile, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto bg-amber-100 p-4 rounded-full mb-4">
             <ShieldAlert className="h-10 w-10 text-amber-600" />
          </div>
          <CardTitle>Approval Pending</CardTitle>
          <CardDescription>
            Your account has been created successfully, but requires Admin approval before you can access the application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
           <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking status...
           </div>
           
           <p className="text-sm text-muted-foreground">
             We will automatically refresh this page once your account is approved.
           </p>

           <Button variant="outline" className="w-full" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
           </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApproval;