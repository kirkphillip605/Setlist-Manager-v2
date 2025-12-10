import { useSyncStatus } from "@/hooks/useSyncedData";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const SyncStatusButton = ({ className, variant = "ghost" }: { className?: string, variant?: "ghost" | "outline" | "default" }) => {
  const { isSyncing, lastSyncedAt, refreshAll } = useSyncStatus();
  const isOnline = useNetworkStatus();

  const handleSync = async () => {
    if (!isOnline) {
        toast.error("Cannot sync while offline");
        return;
    }
    toast.info("Syncing data...");
    await refreshAll();
    toast.success("Data synchronized");
  };

  if (!isOnline) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant={variant} 
            size="icon" 
            onClick={handleSync}
            disabled={isSyncing}
            className={cn("relative", className)}
          >
            <RefreshCw className={cn("h-4 w-4", isSyncing ? "animate-spin text-primary" : "text-muted-foreground")} />
            {!isSyncing && lastSyncedAt > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-green-500 rounded-full border border-background" />
            )}
            <span className="sr-only">Sync Data</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
            <div className="text-xs">
                <p className="font-semibold mb-1">Status: {isSyncing ? "Syncing..." : "Up to date"}</p>
                {lastSyncedAt > 0 && (
                    <p className="text-muted-foreground">
                        Last synced: {formatDistanceToNow(lastSyncedAt, { addSuffix: true })}
                    </p>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">Click to force refresh</p>
            </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};