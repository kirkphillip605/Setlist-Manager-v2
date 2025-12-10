import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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
  const [authLoading, setAuthLoading] = useState(true);
  const queryClient = useQueryClient();

  // 1. Auth State Management
  useEffect(() => {
    let mounted = true;

    // Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (mounted) {
        setSession(newSession);
        setAuthLoading(false);
        // Clear profile cache on sign out
        if (event === 'SIGNED_OUT') {
            queryClient.setQueryData(['profile', session?.user?.id], null);
        }
      }
    });

    // Initial Load
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (mounted) {
        setSession(initialSession);
        setAuthLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  // 2. Cached Profile Fetch
  // We use useQuery so the profile survives offline restarts thanks to the persister
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', session?.user?.id],
    queryFn: async () => {
        if (!session?.user?.id) return null;
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
        if (error) throw error;
        return data as Profile;
    },
    enabled: !!session?.user?.id,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    queryClient.clear(); // Clear all cache on logout for security
    setSession(null);
  };

  const isLoading = authLoading || (!!session && profileLoading && !profile);

  const value = {
    session,
    user: session?.user || null,
    profile: profile || null,
    loading: isLoading,
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