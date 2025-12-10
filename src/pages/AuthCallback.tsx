import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { session, loading, profile } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (session) {
        // If profile is missing needed info, go to profile, else home
        if (profile && (!profile.first_name || !profile.last_name)) {
            navigate("/profile");
        } else {
            navigate("/");
        }
      } else {
        // No session found after loading finished -> Login
        navigate("/login");
      }
    }
  }, [session, loading, navigate, profile]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <h2 className="text-xl font-semibold animate-pulse">Logging you in...</h2>
    </div>
  );
};

export default AuthCallback;