import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper to fetch profile with offline fallback potential
  // (In a real offline scenario, we might want to cache this profile too, 
  // but usually session metadata is enough for basic access control)
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (!error && data) {
        setProfile(data as Profile);
      }
    } catch (e) {
      console.warn("Profile fetch failed (likely offline):", e);
      // Don't clear profile if we have one in memory? 
      // Ideally we'd persist this too, but for now we catch the error.
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // 1. Get session from storage (CapacitorPreferences)
        // This resolves fast and works offline if previously logged in
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (mounted) {
          if (error) {
            // Check if it's a network error? 
            // Usually getSession reads local storage first, so network error shouldn't block it.
            console.warn("Error restoring session:", error);
          }
          
          setSession(initialSession);
          
          if (initialSession?.user) {
            await fetchProfile(initialSession.user.id);
          }
        }
      } catch (error) {
        console.error("Auth initialization exception:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      // Important: If we lose network, 'TOKEN_REFRESH_PWNED' might fire, 
      // but we shouldn't logout the user immediately if it's just connectivity.
      // Supabase client handles auto-refresh retry.
      
      console.log(`Auth event: ${event}`);
      
      if (newSession) {
        setSession(newSession);
        if (newSession.user.id !== session?.user.id) {
           await fetchProfile(newSession.user.id);
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  const value = {
    session,
    user: session?.user || null,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};