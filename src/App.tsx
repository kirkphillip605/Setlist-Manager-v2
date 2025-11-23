import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { MetronomeProvider } from "@/components/MetronomeContext";

import Index from "./pages/Index";
import Login from "./pages/Login";
import SongList from "./pages/SongList";
import SongEdit from "./pages/SongEdit";
import SongDetail from "./pages/SongDetail";
import Setlists from "./pages/Setlists";
import SetlistDetail from "./pages/SetlistDetail";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Protected Route Wrapper
const ProtectedRoute = ({ children, session }: { children: JSX.Element, session: Session | null }) => {
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MetronomeProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              
              <Route path="/" element={<ProtectedRoute session={session}><Index /></ProtectedRoute>} />
              <Route path="/songs" element={<ProtectedRoute session={session}><SongList /></ProtectedRoute>} />
              <Route path="/songs/new" element={<ProtectedRoute session={session}><SongEdit /></ProtectedRoute>} />
              <Route path="/songs/:id" element={<ProtectedRoute session={session}><SongDetail /></ProtectedRoute>} />
              <Route path="/songs/:id/edit" element={<ProtectedRoute session={session}><SongEdit /></ProtectedRoute>} />
              <Route path="/setlists" element={<ProtectedRoute session={session}><Setlists /></ProtectedRoute>} />
              <Route path="/setlists/:id" element={<ProtectedRoute session={session}><SetlistDetail /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute session={session}><Profile /></ProtectedRoute>} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </MetronomeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;