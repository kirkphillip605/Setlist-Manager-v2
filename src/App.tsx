import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
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

import { queryClient, persister } from "@/lib/queryClient";
import { SyncIndicator } from "@/components/SyncIndicator";
import { AuthProvider, useAuth } from "@/context/AuthContext";

// Robust Protected Route
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { session, loading, profile } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    // Redirect to login, but save the attempted location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Ensure profile is loaded before rendering app content to avoid flicker
  // or incomplete data states in children
  if (!profile) {
     // If session exists but no profile yet, we are likely still fetching it 
     // (AuthProvider handles this in parallel, but just in case)
     return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
     );
  }

  // Profile Completion Check
  const isProfileComplete = profile.first_name && profile.last_name;
  if (!isProfileComplete && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace />;
  }

  return children;
};

// Wrapper for public routes to redirect authenticated users
const PublicOnlyRoute = ({ children }: { children: JSX.Element }) => {
    const { session, loading } = useAuth();
    const location = useLocation();
    
    if (loading) return null;

    if (session) {
        // Redirect to where they came from or home
        const from = (location.state as any)?.from?.pathname || "/";
        return <Navigate to={from} replace />;
    }

    return children;
};

const AppContent = () => {
    return (
        <Routes>
            <Route path="/login" element={
                <PublicOnlyRoute>
                    <Login />
                </PublicOnlyRoute>
            } />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/update-password" element={<UpdatePassword />} />
            
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/songs" element={<ProtectedRoute><SongList /></ProtectedRoute>} />
            <Route path="/songs/new" element={<ProtectedRoute><SongEdit /></ProtectedRoute>} />
            <Route path="/songs/:id" element={<ProtectedRoute><SongDetail /></ProtectedRoute>} />
            <Route path="/songs/:id/edit" element={<ProtectedRoute><SongEdit /></ProtectedRoute>} />
            <Route path="/setlists" element={<ProtectedRoute><Setlists /></ProtectedRoute>} />
            <Route path="/setlists/:id" element={<ProtectedRoute><SetlistDetail /></ProtectedRoute>} />
            
            {/* Performance Mode Routes */}
            <Route path="/performance" element={<ProtectedRoute><PerformanceSelection /></ProtectedRoute>} />
            <Route path="/performance/:id" element={<ProtectedRoute><PerformanceMode /></ProtectedRoute>} />

            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
        </Routes>
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
                <Sonner position="top-center" />
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