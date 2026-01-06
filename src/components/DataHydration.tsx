import { useSyncedSongs, useSyncedSetlists, useSyncedGigs, useSyncedSkippedSongs, useSyncManager } from "@/hooks/useSyncedData";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { Progress } from "@/components/ui/progress";

export const DataHydration = ({ children }: { children: React.ReactNode }) => {
  const isOnline = useNetworkStatus();
  const { runDeltaSync } = useSyncManager();
  
  // Trigger all main hooks to start fetching/subscribing
  const songs = useSyncedSongs();
  const setlists = useSyncedSetlists();
  const gigs = useSyncedGigs();
  const skipped = useSyncedSkippedSongs();

  // Calculate Progress
  const queries = [songs, setlists, gigs, skipped];
  const completedCount = queries.filter(q => q.isSuccess || q.isError).length;
  const totalCount = queries.length;
  const progress = Math.round((completedCount / totalCount) * 100);

  // Determine if we are in the initial loading state (loading + no data yet)
  const isHydrating = queries.some(q => q.isLoading && !q.data);

  // Run delta sync on mount (app resume / reconnect logic handled in hook)
  useEffect(() => {
      if (isOnline) {
          runDeltaSync();
      }
  }, [isOnline, runDeltaSync]);

  // Safety timeout
  const [showAnyway, setShowAnyway] = useState(false);
  useEffect(() => {
    if (isHydrating) {
      const timer = setTimeout(() => setShowAnyway(true), 8000);
      return () => clearTimeout(timer);
    }
  }, [isHydrating]);

  if (isHydrating && !showAnyway) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background space-y-8 p-8 animate-in fade-in duration-300">
        <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-primary animate-pulse" />
            </div>
        </div>
        
        <div className="w-full max-w-xs space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>Syncing library...</span>
                <span>{progress}%</span>
            </div>
        </div>

        <p className="text-sm text-muted-foreground text-center">
            Getting everything ready for you.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};