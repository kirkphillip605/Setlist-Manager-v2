import { useStore } from "@/lib/store";
import { Loader2, Database } from "lucide-react";
import { useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { useSyncManager } from "@/hooks/useSyncedData";

export const DataHydration = ({ children }: { children: React.ReactNode }) => {
  const initialize = useStore(state => state.initialize);
  const isInitialized = useStore(state => state.isInitialized);
  const isLoading = useStore(state => state.isLoading);
  const loadingMessage = useStore(state => state.loadingMessage);
  const progress = useStore(state => state.loadingProgress);
  
  // Initialize sync manager (listeners)
  useSyncManager();

  useEffect(() => {
      initialize();
  }, [initialize]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background space-y-8 p-8 animate-in fade-in duration-300">
        <div className="relative">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                <Database className="h-10 w-10 text-primary animate-pulse" />
            </div>
            {isLoading && (
                <div className="absolute -bottom-2 -right-2 bg-background rounded-full p-1 shadow-md">
                    <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                </div>
            )}
        </div>
        
        <div className="w-full max-w-xs space-y-3 text-center">
            <h3 className="font-semibold text-lg">{loadingMessage}</h3>
            
            {progress > 0 && progress < 100 && (
                <Progress value={progress} className="h-2" />
            )}
            
            <p className="text-xs text-muted-foreground">
                Synchronizing your library for offline access.
            </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};