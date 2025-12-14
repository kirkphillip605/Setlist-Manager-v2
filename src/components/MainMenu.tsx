import { 
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription 
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { 
  Menu, Settings, Shield, User, LogOut, Moon, Sun, 
  Cloud, RefreshCw, CheckCircle2, CloudOff 
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/components/theme-provider";
import { useSyncStatus } from "@/hooks/useSyncedData";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";

export const MainMenu = () => {
  const navigate = useNavigate();
  const { signOut, isAdmin } = useAuth();
  const { setTheme, theme } = useTheme();
  const { isSyncing, lastSyncedAt, refreshAll } = useSyncStatus();
  const isOnline = useNetworkStatus();
  const [open, setOpen] = useState(false);

  const handleSync = async () => {
    if (!isOnline) return;
    await refreshAll();
    toast.success("Data synchronized");
  };

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate("/login");
  };

  const handleNav = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] sm:w-[350px] flex flex-col gap-0 p-0">
        
        {/* Header / Sync Status Area */}
        <div className="bg-primary/10 border-b p-6 pt-10">
          <SheetHeader className="mb-4 text-left">
            <SheetTitle className="flex items-center gap-2">
               Menu
            </SheetTitle>
            <SheetDescription className="hidden">Main Navigation</SheetDescription>
          </SheetHeader>

          <div className="bg-background/50 backdrop-blur rounded-lg p-3 border shadow-sm">
             <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                    {isOnline ? <Cloud className="h-4 w-4 text-primary" /> : <CloudOff className="h-4 w-4 text-muted-foreground" />}
                    {isOnline ? "Cloud Sync" : "Offline"}
                </div>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0 hover:bg-background" 
                    onClick={handleSync}
                    disabled={!isOnline || isSyncing}
                >
                    <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
                </Button>
             </div>
             
             <div className="text-xs text-muted-foreground">
                {isSyncing ? (
                    <span className="text-primary flex items-center gap-1">Syncing changes...</span>
                ) : (
                    <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                        Last synced {lastSyncedAt > 0 ? formatDistanceToNow(lastSyncedAt, { addSuffix: true }) : 'Never'}
                    </span>
                )}
             </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto py-4 px-4 space-y-6">
            
            {/* App Settings Group */}
            <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">App Settings</h3>
                <div className="space-y-1">
                    <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        {theme === 'dark' ? "Light Mode" : "Dark Mode"}
                    </Button>
                    <Button variant="ghost" className="w-full justify-start gap-3" disabled>
                        <Settings className="h-4 w-4" />
                        Preferences (Coming Soon)
                    </Button>
                </div>
            </div>

            {/* Admin Group */}
            {isAdmin && (
                <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Band Admin</h3>
                    <div className="space-y-1">
                        <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => handleNav("/admin/users")}>
                            <Shield className="h-4 w-4" />
                            Manage Users
                        </Button>
                    </div>
                </div>
            )}

            {/* Account Group */}
            <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Account</h3>
                <div className="space-y-1">
                    <Button variant="ghost" className="w-full justify-start gap-3" onClick={() => handleNav("/profile")}>
                        <User className="h-4 w-4" />
                        Profile & Security
                    </Button>
                    <Button variant="ghost" className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleSignOut}>
                        <LogOut className="h-4 w-4" />
                        Sign Out
                    </Button>
                </div>
            </div>

        </div>
        
        {/* Footer info */}
        <div className="p-4 text-center text-xs text-muted-foreground border-t bg-muted/10">
            Setlist Manager Pro v1.0
        </div>

      </SheetContent>
    </Sheet>
  );
};