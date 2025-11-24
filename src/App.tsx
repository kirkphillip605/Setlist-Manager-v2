import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { MetronomeProvider } from "@/components/MetronomeContext";
import { Loader2 } from "lucide-react";

import Index from "./pages/Index";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import UpdatePassword from "./pages/UpdatePassword";
import SongList from "./pages/SongList";
import SongEdit from "./pages/SongEdit";
import SongDetail from "./pages/SongDetail";
import Setlists from "./pages/Setlists";
import SetlistDetail from "./pages/SetlistDetail";
import Profile from "./pages/Profile";
import AdminUsers from "./pages/AdminUsers";
import PerformanceSelection from "./pages/PerformanceSelection";
import PerformanceMode from "./pages/PerformanceMode";
import NotFound from "./pages/NotFound";

// Import the persisted client configuration
import { queryClient, persister } from "@/lib/queryClient";
import { SyncIndicator } from "@/components/SyncIndicator";

// Protected Route Wrapper with Profile Check
const ProtectedRoute = ({ children, session }: { children: JSX.Element, session: Session | null }) => {
  const location = useLocation();
  const [isProfileChecked, setIsProfileChecked] = useState(false);
  const [isProfileComplete, setIsProfileComplete] = useState(true);

  useEffect(() => {
    if (!session) return;

    const checkProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', session.user.id)
          .single();

        if (!data?.first_name || !data?.last_name) {
          setIsProfileComplete(false);
        } else {
          setIsProfileComplete(true);
        }
      } catch (err) {
        console.error("Profile check failed", err);
      } finally {
        setIsProfileChecked(true);
      }
    };

    checkProfile();
  }, [session]);

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Show loader while checking profile status
  if (!isProfileChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Redirect to profile if incomplete and not already there
  if (!isProfileComplete && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace />;
  }

  return children;
};

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check active session on startup
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
      } catch (error) {
        console.error("Error checking session:", error);
      } finally {
        setLoading(false);
      }
    };

    initSession();

    // 2. Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (_event === 'SIGNED_OUT') {
        queryClient.clear();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Loading...</p>
      </div>
    );
  }

  return (
    <PersistQueryClientProvider 
      client={queryClient} 
      persistOptions={{ persister }}
      onSuccess={() => {
        // Optional: Data restored from cache successfully
        console.log("App data restored from offline cache");
      }}
    >
      <TooltipProvider>
        <MetronomeProvider>
          <Toaster />
          <Sonner position="top-center" />
          <SyncIndicator />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/update-password" element={<UpdatePassword />} />
              
              <Route path="/" element={<ProtectedRoute session={session}><Index /></ProtectedRoute>} />
              <Route path="/songs" element={<ProtectedRoute session={session}><SongList /></ProtectedRoute>} />
              <Route path="/songs/new" element={<ProtectedRoute session={session}><SongEdit /></ProtectedRoute>} />
              <Route path="/songs/:id" element={<ProtectedRoute session={session}><SongDetail /></ProtectedRoute>} />
              <Route path="/songs/:id/edit" element={<ProtectedRoute session={session}><SongEdit /></ProtectedRoute>} />
              <Route path="/setlists" element={<ProtectedRoute session={session}><Setlists /></ProtectedRoute>} />
              <Route path="/setlists/:id" element={<ProtectedRoute session={session}><SetlistDetail /></ProtectedRoute>} />
              
              {/* Performance Mode Routes */}
              <Route path="/performance" element={<ProtectedRoute session={session}><PerformanceSelection /></ProtectedRoute>} />
              <Route path="/performance/:id" element={<ProtectedRoute session={session}><PerformanceMode /></ProtectedRoute>} />

              <Route path="/profile" element={<ProtectedRoute session={session}><Profile /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute session={session}><AdminUsers /></ProtectedRoute>} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </MetronomeProvider>
      </TooltipProvider>
    </PersistQueryClientProvider>
  );
};

export default App;