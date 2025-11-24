import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Hang tight while we finish logging you in...");

  useEffect(() => {
    const handleAuth = async () => {
      // Small delay to ensure session is established by the global listener
      setTimeout(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // If no session, maybe send to login
          navigate("/login");
          return;
        }

        // Check if profile is complete (e.g. has name)
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", session.user.id)
          .single();

        // Simulate the requested 5 second delay for effect
        setTimeout(() => {
          if (!profile?.first_name || !profile?.last_name) {
             navigate("/profile"); // Send to profile to complete info
          } else {
             navigate("/"); // Send to dashboard
          }
        }, 4000); 

      }, 1000);
    };

    handleAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <h2 className="text-xl font-semibold animate-pulse">{message}</h2>
    </div>
  );
};

export default AuthCallback;