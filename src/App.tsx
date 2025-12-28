import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { MetronomeProvider } from "@/components/MetronomeContext";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";

import Index from "./pages/Index";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import UpdatePassword from "./pages/UpdatePassword";
import VerifyEmail from "./pages/VerifyEmail";
import OnboardingWizard from "./pages/OnboardingWizard";
import SongList from "./pages/SongList";
import SongEdit from "./pages/SongEdit";
import SongDetail from "./pages/SongDetail";
import Setlists from "./pages/Setlists";
import SetlistDetail from "./pages/SetlistDetail";
import Gigs from "./pages/Gigs";
import GigDetail from "./pages/GigDetail";
import Profile from "./pages/Profile";
import AdminUsers from "./pages/AdminUsers";
import AdminSessions from "./pages/AdminSessions";
import PerformanceSelection from "./pages/PerformanceSelection";
import PerformanceMode from "./pages/PerformanceMode";
import NotFound from "./pages/NotFound";
import PendingApproval from "./pages/PendingApproval";
import ReactivateAccount from "./pages/ReactivateAccount";

import { queryClient, persister } from "@/lib/queryClient";
import { SyncIndicator } from "@/components/SyncIndicator";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { DataHydration } from "@/components/DataHydration";
import ScrollToTop from "@/components/ScrollToTop";
import { ImmersiveModeProvider } from "@/context/ImmersiveModeContext";
import { useAppStatus } from "@/hooks/useAppStatus";
import { SystemStatusScreen } from "@/components/SystemStatusScreen";
import { MobileAppSuggestion } from "@/components/MobileAppSuggestion";
import { storageAdapter } from "@/lib/storageAdapter";

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

  // 1. Check inactive (Soft Deleted)
  if (profile && !profile.is_active) {
      if (location.pathname !== '/reactivate') {
          return <Navigate to="/reactivate" replace />;
      }
      return children;
  }

  // 2. Check Profile Completion (Name & Position) OR Password not set
  const isProfileComplete = profile && profile.first_name && profile.last_name && profile.position;
  const hasPassword = profile && profile.has_password !== false; // has_password can be true or null (old users)

  if (!isProfileComplete || !hasPassword) {
      if (location.pathname !== '/onboarding') {
        return <Navigate to="/onboarding" replace />;
      }
      return children;
  }

  // 3. Check Pending Approval (Must be done AFTER profile is set)
  if (profile && !profile.is_approved) {
      if (location.pathname !== '/pending') {
          return <Navigate to="/pending" replace />;
      }
      return children;
  }

  // Redirect away from special pages if conditions are met
  if (location.pathname === '/pending' && profile?.is_approved) return <Navigate to="/" replace />;
  if (location.pathname === '/reactivate' && profile?.is_active) return <Navigate to="/" replace />;
  if (location.pathname === '/onboarding' && isProfileComplete && hasPassword) return <Navigate to="/" replace />;

  // Enforce Data Hydration for authenticated users
  return (
    <DataHydration>
      {children}
    </DataHydration>
  );
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
            const isGoogleAuth = event.url.includes('google-auth') || event.url.includes('auth/callback');

            if (isGoogleAuth) {
                try {
                    const urlObj = new URL(event.url);
                    let code = urlObj.searchParams.get('code');
                    
                    if (!code && urlObj.hash) {
                         const params = new URLSearchParams(urlObj.hash.substring(1));
                         code = params.get('code') || params.get('access_token');
                    }

                    if (code) {
                        await supabase.auth.exchangeCodeForSession(code);
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
            <ScrollToTop />
            <Routes>
                <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/verify-email" element={<PublicOnlyRoute><VerifyEmail /></PublicOnlyRoute>} />
                <Route path="/update-password" element={<UpdatePassword />} />
                
                {/* Special Logic Routes (Protected checks handle the rendering) */}
                <Route path="/onboarding" element={<ProtectedRoute><OnboardingWizard /></ProtectedRoute>} />
                <Route path="/pending" element={<ProtectedRoute><PendingApproval /></ProtectedRoute>} />
                <Route path="/reactivate" element={<ProtectedRoute><ReactivateAccount /></ProtectedRoute>} />

                <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/songs" element={<ProtectedRoute><SongList /></ProtectedRoute>} />
                <Route path="/songs/new" element={<ProtectedRoute><SongEdit /></ProtectedRoute>} />
                <Route path="/songs/:id" element={<ProtectedRoute><SongDetail /></ProtectedRoute>} />
                <Route path="/songs/:id/edit" element={<ProtectedRoute><SongEdit /></ProtectedRoute>} />
                <Route path="/setlists" element={<ProtectedRoute><Setlists /></ProtectedRoute>} />
                <Route path="/setlists/:id" element={<ProtectedRoute><SetlistDetail /></ProtectedRoute>} />
                <Route path="/gigs" element={<ProtectedRoute><Gigs /></ProtectedRoute>} />
                <Route path="/gigs/:id" element={<ProtectedRoute><GigDetail /></ProtectedRoute>} />
                
                <Route path="/performance" element={<ProtectedRoute><PerformanceSelection /></ProtectedRoute>} />
                <Route path="/performance/:id" element={<ProtectedRoute><PerformanceMode /></ProtectedRoute>} />

                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
                <Route path="/admin/sessions" element={<ProtectedRoute><AdminSessions /></ProtectedRoute>} />
                
                <Route path="*" element={<NotFound />} />
            </Routes>
        </>
    );
}

// Wrapper component to handle System Status logic at the top level
const AppStatusWrapper = () => {
    const { isMaintenance, isUpdateRequired, statusData, loading } = useAppStatus();
    const [showSuggestion, setShowSuggestion] = useState(false);

    useEffect(() => {
      const checkSuggestion = async () => {
        const dismissed = await storageAdapter.getItem("dismissed_mobile_app_suggestion");
        if (!dismissed) {
          setShowSuggestion(true);
        }
      };
      checkSuggestion();
    }, []);

    const handleDismissSuggestion = () => {
      setShowSuggestion(false);
      storageAdapter.setItem("dismissed_mobile_app_suggestion", "true");
    };

    if (loading) {
        // Optional: Show splash or nothing while checking status
        return null;
    }

    if (isUpdateRequired) {
        return <SystemStatusScreen status={statusData} mode="update" />;
    }

    if (isMaintenance) {
        return <SystemStatusScreen status={statusData} mode="maintenance" />;
    }

    return (
        <BrowserRouter>
            {showSuggestion && <MobileAppSuggestion onDismiss={handleDismissSuggestion} />}
            <AppContent />
        </BrowserRouter>
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
            <ImmersiveModeProvider>
                <MetronomeProvider>
                    <Toaster />
                    <Sonner position="bottom-center" closeButton toastOptions={{ className: "mb-[60px] md:mb-0" }} />
                    <SyncIndicator />
                    <AppStatusWrapper />
                </MetronomeProvider>
            </ImmersiveModeProvider>
        </AuthProvider>
      </TooltipProvider>
    </PersistQueryClientProvider>
  );
};

export default App;