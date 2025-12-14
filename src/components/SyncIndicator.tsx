import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { Loader2, Cloud, CloudOff, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useSyncStatus } from "@/hooks/useSyncedData";

export const SyncIndicator = () => {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showSaved, setShowSaved] = useState(false);
  const { refreshAll } = useSyncStatus();

  const isSyncing = isFetching > 0 || isMutating > 0;

  useEffect(() => {
    const handleOnline = () => {
        setIsOnline(true);
        // Auto-sync when coming back online
        refreshAll(); 
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshAll]);

  // Show "Saved" momentarily after syncing finishes
  useEffect(() => {
    if (!isSyncing && isOnline) {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isSyncing, isOnline]);

  if (!isOnline) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-destructive text-destructive-foreground px-3 py-2 rounded-full shadow-lg flex items-center gap-2 text-xs font-medium animate-in slide-in-from-bottom-5">
        <CloudOff className="h-3 w-3" />
        <span>Offline Mode</span>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-primary text-primary-foreground px-3 py-2 rounded-full shadow-lg flex items-center gap-2 text-xs font-medium animate-in slide-in-from-bottom-5">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Syncing...</span>
      </div>
    );
  }

  if (showSaved) {
     return (
      <div className="fixed bottom-4 right-4 z-50 bg-green-600 text-white px-3 py-2 rounded-full shadow-lg flex items-center gap-2 text-xs font-medium animate-in slide-in-from-bottom-5 fade-out duration-1000">
        <CheckCircle2 className="h-3 w-3" />
        <span>Up to date</span>
      </div>
    );
  }

  return null;
};