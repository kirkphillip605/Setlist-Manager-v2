import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { storageAdapter } from "@/lib/storageAdapter";
import { Profile } from "@/types";
import { clear as clearIdb } from "idb-keyval";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

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
            // If refresh token is missing/invalid, force logout
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
            // If local state has session but Supabase doesn't, sync it
            setSession(null);
        }
    } catch (e) {
        console.error("Unexpected session check failure:", e);
    }
  }, [session]);

  const handleSignOut = async () => {
    setAuthLoading(true);
    
    try {
        // 1. Supabase SignOut
        await supabase.auth.signOut();
    } catch (e) {
        console.error("Supabase signOut failed (likely offline):", e);
    }

    try {
        // 2. Clear React Query Cache (In-Memory)
        queryClient.removeQueries();
        queryClient.clear();
        
        // 3. Clear Persisted Query Cache
        await storageAdapter.removeItem("REACT_QUERY_OFFLINE_CACHE");
        
        // 4. Clear IndexedDB (Images/Assets)
        await clearIdb();

        // 5. Aggressively clear Auth Tokens
        if (Capacitor.isNativePlatform()) {
            await Preferences.clear(); // Clears everything in Preferences
            // Restore 'login_email' if it existed, as that's a user preference, not session data
            // (handled by Login page reading before this, but if we want to keep it across logout we should save/restore)
            // Ideally we only delete keys starting with 'sb-' but Preferences doesn't support 'keys()' well on all platforms.
            // For now, full clear is safest to ensure tokens are gone.
        } else {
            localStorage.clear(); // Clears everything on web
        }

        // 6. Update State
        setSession(null);
        
    } catch (e) {
        console.warn("Failed to clear local cache during signout", e);
    } finally {
        setAuthLoading(false);
        // Force reload to ensure clean state if needed, or just let Router handle it
        // window.location.href = '/login'; 
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
        console.log("Auth State Change:", event);
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

  // Handle Offline Profile Fetching
  const { data: profile, isLoading: profileLoading, refetch } = useQuery({
    queryKey: ['profile', session?.user?.id],
    queryFn: async () => {
        if (!session?.user?.id) return null;
        
        // Ensure profile exists in local cache or fetch
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
        
        if (error) {
            console.error("Profile fetch error:", error);
            // If 406 Not Acceptable or similar auth issue
            if (error.code === 'PGRST301' || error.message.includes("JWT")) { 
                checkSession();
            }
            return null; // Return null to allow retry or graceful degrade
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