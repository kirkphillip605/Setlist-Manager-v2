import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { storageAdapter } from "@/lib/storageAdapter";
import { Profile, Setlist } from "@/types";
import { clear as clearIdb } from "idb-keyval";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { useStore } from "@/lib/store";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  canManageGigs: boolean;
  canEditSetlist: (setlist: Setlist) => boolean;
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
  isManager: false,
  canManageGigs: false,
  canEditSetlist: () => false,
  signOut: async () => {},
  refreshProfile: () => {},
  checkSession: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const queryClient = useQueryClient();
  const resetStore = useStore(state => state.reset);

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
            setSession(null);
        }
    } catch (e) {
        console.error("Unexpected session check failure:", e);
    }
  }, [session]);

  const handleSignOut = async () => {
    setAuthLoading(true);
    
    try {
        await supabase.auth.signOut();
    } catch (e) {
        console.error("Supabase signOut failed (likely offline):", e);
    }

    try {
        queryClient.removeQueries();
        queryClient.clear();
        await storageAdapter.removeItem("REACT_QUERY_OFFLINE_CACHE");
        await clearIdb();

        if (Capacitor.isNativePlatform()) {
            await Preferences.clear(); 
        } else {
            localStorage.clear(); 
        }

        // Reset the Zustard store (Songs, Setlists, etc.)
        await resetStore();

        setSession(null);
    } catch (e) {
        console.warn("Failed to clear local cache during signout", e);
    } finally {
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
            await resetStore(); // Ensure cleanup on auto-logout events too
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
  }, [queryClient, checkSession, resetStore]);

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
            console.error("Profile fetch error:", error);
            if (error.code === 'PGRST301' || error.message.includes("JWT")) { 
                checkSession();
            }
            return null;
        }
        return data as Profile;
    },
    enabled: !!session?.user?.id,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });

  const isLoading = authLoading || (!!session && profileLoading && !profile);
  
  // -- Permission Helpers --
  const isAdmin = profile?.role === 'admin';
  const isManager = profile?.role === 'manager' || isAdmin;
  const canManageGigs = isManager;

  const canEditSetlist = (setlist: Setlist) => {
      if (isAdmin) return true;
      if (setlist.created_by === session?.user?.id) return true;
      // Managers can edit any band setlist (not personal)
      if (isManager && !setlist.is_personal) return true;
      return false;
  };

  const value = {
    session,
    user: session?.user || null,
    profile: profile || null,
    loading: isLoading,
    isAdmin,
    isManager,
    canManageGigs,
    canEditSetlist,
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