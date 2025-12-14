import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { MetronomeProvider } from "@/components/MetronomeContext";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";

import Index from "./pages/Index";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import UpdatePassword from "./pages/UpdatePassword";
import SongList from "./pages/SongList";
import SongEdit from "./pages/SongEdit";
import SongDetail from "./pages/SongDetail";
import Setlists from "./pages/Setlists";
import SetlistDetail from "./pages/SetlistDetail";
import Gigs from "./pages/Gigs";
import GigDetail from "./pages/GigDetail";
import Profile from "./pages/Profile";
import AdminUsers from "./pages/AdminUsers";
import PerformanceSelection from "./pages/PerformanceSelection";
import PerformanceMode from "./pages/PerformanceMode";
import NotFound from "./pages/NotFound";

import { queryClient, persister } from "@/lib/queryClient";
import { SyncIndicator } from "@/components/SyncIndicator";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CacheWarmer } from "@/components/CacheWarmer";

// Robust Protected Route
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { session, loading, profile, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If session exists but profile failed to load (offline + no cache)
  if (!profile) {
     return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-4 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <h2 className="text-xl font-semibold">Unable to load profile</h2>
            <p className="text-muted-foreground">Please check your internet connection and try again.</p>
            <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
            <Button variant="ghost" onClick={() => signOut()}>Sign Out</Button>
        </div>
     );
  }

  const isProfileComplete = profile.first_name && profile.last_name;
  if (!isProfileComplete && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace />;
  }

  return children;
};

const PublicOnlyRoute = ({ children }: { children: JSX.Element }) => {
    const { session, loading } = useAuth();
    const location = useLocation();
    
    if (loading) return null;

    if (session) {
        const from = (location.state as any)?.from?.pathname || "/";
        return <Navigate to={from} replace />;
    }

    return children;
};

const AppContent = () => {
    // Setup Deep Link Listener
    useEffect(() => {
        CapacitorApp.addListener('appUrlOpen', async (event) => {
            console.log("App opened with URL:", event.url);
            
            // Handle Auth Callback (PKCE Flow)
            if (event.url.includes('auth/callback') || event.url.includes('code=')) {
                try {
                    const url = new URL(event.url);
                    const code = url.searchParams.get('code');
                    
                    if (code) {
                        console.log("Exchanging code for session...");
                        const { error } = await supabase.auth.exchangeCodeForSession(code);
                        if (error) {
                            console.error("Auth Error:", error.message);
                        }
                    }
                } catch (e) {
                    console.error("Error parsing auth URL:", e);
                }
            }
        });
        
        return () => {
            CapacitorApp.removeAllListeners();
        };
    }, []);

    return (
        <>
            <CacheWarmer />
            <Routes>
                <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/update-password" element={<UpdatePassword />} />
                
                <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/songs" element={<ProtectedRoute><SongList /></ProtectedRoute>} />
                <Route path="/songs/new" element={<ProtectedRoute><SongEdit /></ProtectedRoute>} />
                <Route path="/songs/:id" element={<ProtectedRoute><SongDetail /></ProtectedRoute>} />
                <Route path="/songs/:id/edit" element={<ProtectedRoute><SongEdit /></ProtectedRoute>} />
                <Route path="/setlists" element={<ProtectedRoute><Setlists /></ProtectedRoute>} />
                <Route path="/setlists/:id" element={<ProtectedRoute><SetlistDetail /></ProtectedRoute>} />
                <Route path="/gigs" element={<ProtectedRoute><Gigs /></ProtectedRoute>} />
                <Route path="/gigs/:id" element={<ProtectedRoute><GigDetail /></ProtectedRoute>} />
                
                {/* Performance Mode Routes */}
                <Route path="/performance" element={<ProtectedRoute><PerformanceSelection /></ProtectedRoute>} />
                <Route path="/performance/:id" element={<ProtectedRoute><PerformanceMode /></ProtectedRoute>} />

                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
                
                <Route path="*" element={<NotFound />} />
            </Routes>
        </>
    );
}

const App = () => {
  return (
    <PersistQueryClientProvider 
      client={queryClient} 
      persistOptions={{ persister }}
      onSuccess={() => console.log("App data restored from offline cache")}
    >
      <TooltipProvider>
        <AuthProvider>
            <MetronomeProvider>
                <Toaster />
                {/* Sonner Configured for Mobile/Desktop Bottom Position + Close Button */}
                <Sonner 
                    position="bottom-center" 
                    closeButton 
                    toastOptions={{
                        className: "mb-[60px] md:mb-0", // Lift above mobile nav
                    }}
                />
                <SyncIndicator />
                <BrowserRouter>
                    <AppContent />
                </BrowserRouter>
            </MetronomeProvider>
        </AuthProvider>
      </TooltipProvider>
    </PersistQueryClientProvider>
  );
};

export default App;