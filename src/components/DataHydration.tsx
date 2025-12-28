import { useSyncedSongs, useSyncedSetlists, useSyncedGigs, useSyncedSkippedSongs } from "@/hooks/useSyncedData";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export const DataHydration = ({ children }: { children: React.ReactNode }) => {
  const isOnline = useNetworkStatus();
  
  // Trigger all main hooks to start fetching/subscribing
  const songs = useSyncedSongs();
  const setlists = useSyncedSetlists();
  const gigs = useSyncedGigs();
  const skipped = useSyncedSkippedSongs();

  // Determine if we are in the initial loading state (loading + no data yet)
  const isHydrating = 
    (songs.isLoading && !songs.data) || 
    (setlists.isLoading && !setlists.data) || 
    (gigs.isLoading && !gigs.data);

  // Safety timeout: If loading takes too long (e.g. offline with empty cache), allow render after 5s
  const [showAnyway, setShowAnyway] = useState(false);

  useEffect(() => {
    if (isHydrating) {
      const timer = setTimeout(() => {
        setShowAnyway(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isHydrating]);

  if (isHydrating && !showAnyway) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background space-y-6 animate-in fade-in duration-300">
        <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-primary animate-pulse" />
            </div>
        </div>
        <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">Syncing Library</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Downloading songs, setlists, and gigs...
            </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};