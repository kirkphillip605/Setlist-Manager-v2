import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, Loader2, ArrowLeft } from "lucide-react";

const VerifyEmail = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // 1. Listen for auth state changes (e.g., if link opens in same tab/app)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/"); // App router handles redirection to wizard if needed
      }
    });

    // 2. Poll occasionally in case verified in another tab
    const interval = setInterval(async () => {
      setChecking(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      }
      setChecking(false);
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto bg-primary/10 p-4 rounded-full mb-4">
             <Mail className="h-10 w-10 text-primary" />
          </div>
          <CardTitle>Verify your Email</CardTitle>
          <CardDescription>
            We've sent a confirmation link to your email address. Please click the link to activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
           <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground h-5">
              {checking && <Loader2 className="h-3 w-3 animate-spin" />}
              Waiting for verification...
           </div>
           
           <p className="text-xs text-muted-foreground">
             Once verified, this page will automatically refresh, or you can proceed to login manually.
           </p>

           <Button variant="ghost" className="w-full" onClick={() => navigate("/login")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
           </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmail;