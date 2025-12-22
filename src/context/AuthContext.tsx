import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { storageAdapter } from "@/lib/storageAdapter";
import { Profile } from "@/types";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => void;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  signOut: async () => {},
  refreshProfile: () => {},
  checkSession: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const queryClient = useQueryClient();

  const checkSession = useCallback(async () => {
    try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
            console.error("Session check error:", error);
            if (error.message.includes("refresh_token_not_found") || error.status === 400) {
               await handleSignOut();
               return;
            }
        }

        if (currentSession) {
            if (currentSession.access_token !== session?.access_token) {
                setSession(currentSession);
            }
        } else if (session) {
            await handleSignOut();
        }
    } catch (e) {
        console.error("Unexpected session check failure:", e);
    }
  }, [session]);

  const handleSignOut = async () => {
    setAuthLoading(true);
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    } catch (e) {
        console.error("Sign out error, forcing cleanup", e);
    } finally {
        queryClient.removeQueries();
        queryClient.clear();
        
        try {
            await storageAdapter.removeItem("REACT_QUERY_OFFLINE_CACHE");
        } catch (e) {
            console.warn("Failed to clear offline cache", e);
        }

        setSession(null);
        setAuthLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
        try {
            const { data: { session: initialSession } } = await supabase.auth.getSession();
            if (mounted) {
                setSession(initialSession);
                setAuthLoading(false);
            }
        } catch (e) {
            console.error("Init session error", e);
            if (mounted) setAuthLoading(false);
        }
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (mounted) {
        if (event === 'SIGNED_OUT') {
            queryClient.clear();
            setSession(null);
        } else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
            setSession(newSession);
        }
        setAuthLoading(false);
      }
    });

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            checkSession();
        }
    };
    
    const handleFocus = () => {
        checkSession();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [queryClient, checkSession]);

  const { data: profile, isLoading: profileLoading, refetch } = useQuery({
    queryKey: ['profile', session?.user?.id],
    queryFn: async () => {
        if (!session?.user?.id) return null;
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
        
        if (error) {
            if (error.code === 'PGRST301' || error.message.includes("JWT")) { 
                checkSession();
            }
            throw error;
        }
        return data as Profile;
    },
    enabled: !!session?.user?.id,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });

  const isLoading = authLoading || (!!session && profileLoading && !profile);

  const value = {
    session,
    user: session?.user || null,
    profile: profile || null,
    loading: isLoading,
    isAdmin: profile?.role === 'admin',
    signOut: handleSignOut,
    refreshProfile: refetch,
    checkSession
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