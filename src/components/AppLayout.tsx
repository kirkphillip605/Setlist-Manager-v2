import { Link, useLocation, useNavigate } from "react-router-dom";
import { Music, ListMusic, Home, Settings, PlayCircle, CalendarDays, ChevronLeft, ChevronRight, Play, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { MetronomeControls } from "./MetronomeControls";
import { ModeToggle } from "./mode-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useEffect, useState, useLayoutEffect } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/context/AuthContext";
import { SyncStatusButton } from "./SyncStatusButton";
import { PendingApprovalNotifier } from "./PendingApprovalNotifier";
import { MainMenu } from "./MainMenu";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, isAdmin } = useAuth();
  
  const { theme } = useTheme();
  const [isDarkMode, setIsDarkMode] = useState(theme === 'dark');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Dynamic Sidebar Items Calculation
  const [maxVisibleItems, setMaxVisibleItems] = useState(10);

  useEffect(() => {
    if (theme === 'system') {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const updateMode = () => {
            setIsDarkMode(mediaQuery.matches);
        };
        updateMode();
        mediaQuery.addEventListener('change', updateMode);
        return () => mediaQuery.removeEventListener('change', updateMode);
    } else {
        setIsDarkMode(theme === 'dark');
    }
  }, [theme]);

  const logoPath = isDarkMode ? "/setlist-logo-dark.png" : "/setlist-logo-transparent.png";
  const iconPath = "/setlist-icon.png";

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  // Nav Definition
  const mainNavItems = [
    { icon: Home, label: "Dashboard", path: "/" },
    { icon: Music, label: "Songs", path: "/songs" },
    { icon: Play, label: "Perform", path: "/performance" },
    { icon: ListMusic, label: "Setlists", path: "/setlists" },
    { icon: CalendarDays, label: "Gigs", path: "/gigs" },
    { icon: Settings, label: "Settings", id: "settings" }, // Special handling
  ];

  // Mobile Nav (Bottom) - Only first 5 items (Dashboard, Songs, Perform, Setlists, Gigs)
  const mobileNavItems = mainNavItems.filter(i => i.id !== 'settings');

  // Sidebar Resize Logic
  useLayoutEffect(() => {
    const calculateItems = () => {
      const h = window.innerHeight;
      // Fixed areas: Header (~120px) + Footer/Controls (~80px depending on state)
      // Actually we have Metronome Controls at bottom of sidebar which takes space.
      // Let's reserve ~250px for logo area + metronome + margins.
      const reservedSpace = 280;
      const itemHeight = 48; // Approx px per item
      
      const availableHeight = h - reservedSpace;
      const possibleItems = Math.floor(availableHeight / itemHeight);
      
      setMaxVisibleItems(Math.max(1, possibleItems));
    };

    calculateItems();
    window.addEventListener('resize', calculateItems);
    return () => window.removeEventListener('resize', calculateItems);
  }, []);

  const visibleItems = mainNavItems.slice(0, maxVisibleItems);
  const overflowItems = mainNavItems.slice(maxVisibleItems);
  const showMoreButton = overflowItems.length > 0;
  
  // If showing "More" button takes up a slot, we need to adjust logic, but slicing is simple enough.
  // Ideally if overflowItems.length > 0, we slice 0 to maxVisibleItems - 1 to make room for "More".
  const finalVisibleItems = showMoreButton ? mainNavItems.slice(0, maxVisibleItems - 1) : mainNavItems;
  const finalOverflowItems = showMoreButton ? mainNavItems.slice(maxVisibleItems - 1) : [];

  const handleItemClick = (item: any) => {
      if (item.id === 'settings') {
          setIsSettingsOpen(true);
      } else if (item.path) {
          navigate(item.path);
      }
  };

  return (
    <div className={cn(
        "min-h-screen bg-background text-foreground transition-all duration-300",
        "pb-[calc(90px+env(safe-area-inset-bottom))] md:pb-0", // Increased bottom padding for floating FAB
        isSidebarCollapsed ? "md:pl-[80px]" : "md:pl-64"
    )}>
      {isAdmin && <PendingApprovalNotifier />}

      {/* Controlled Main Menu Sheet (Triggered by Settings) */}
      <MainMenu open={isSettingsOpen} onOpenChange={setIsSettingsOpen} trigger={<span/>} />

      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden md:flex fixed left-0 top-0 h-full flex-col border-r bg-card/50 backdrop-blur-xl z-20 transition-all duration-300",
        isSidebarCollapsed ? "w-[80px]" : "w-64"
      )}>
        {/* Collapse Button */}
        <div className="absolute -right-3 top-9 z-30">
            <Button
                variant="outline"
                size="icon"
                className="h-6 w-6 rounded-full border shadow-sm bg-background text-foreground hover:bg-accent"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            >
                {isSidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
            </Button>
        </div>

        <div className={cn("flex flex-col mb-4 pt-6 transition-all shrink-0", isSidebarCollapsed ? "items-center px-0" : "px-4")}>
          <div className={cn("flex items-center mb-4 transition-all", isSidebarCollapsed ? "justify-center" : "justify-between")}>
             {isSidebarCollapsed ? (
                 <img src={iconPath} alt="Icon" className="w-8 h-8" />
             ) : (
                 <img src={logoPath} alt="Setlist Manager Pro" className="h-8 object-contain" />
             )}
          </div>
          
          <div className={cn("flex items-center gap-1", isSidebarCollapsed ? "flex-col" : "flex-row")}>
             <SyncStatusButton />
             <ModeToggle />
          </div>
        </div>
        
        <nav className="space-y-2 flex-1 px-3 overflow-hidden">
          {finalVisibleItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleItemClick(item)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg transition-all duration-200 font-medium",
                isSidebarCollapsed ? "justify-center p-3" : "px-3 py-2.5 text-sm",
                location.pathname === item.path || (item.id === 'settings' && isSettingsOpen)
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
              )}
              title={isSidebarCollapsed ? item.label : undefined}
            >
              <item.icon className={cn("shrink-0", isSidebarCollapsed ? "w-5 h-5" : "w-4 h-4")} />
              {!isSidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}

          {finalOverflowItems.length > 0 && (
              <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                        className={cn(
                            "flex w-full items-center gap-3 rounded-lg transition-all duration-200 font-medium hover:bg-accent hover:text-accent-foreground text-muted-foreground",
                            isSidebarCollapsed ? "justify-center p-3" : "px-3 py-2.5 text-sm"
                        )}
                    >
                        <MoreHorizontal className={cn("shrink-0", isSidebarCollapsed ? "w-5 h-5" : "w-4 h-4")} />
                        {!isSidebarCollapsed && <span>More</span>}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" className="w-48">
                      {finalOverflowItems.map(item => (
                          <DropdownMenuItem key={item.label} onClick={() => handleItemClick(item)} className="gap-2 py-2.5">
                              <item.icon className="w-4 h-4" />
                              {item.label}
                          </DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>
              </DropdownMenu>
          )}
        </nav>

        {!isSidebarCollapsed && <MetronomeControls variant="desktop" />}
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 border-b bg-background/80 backdrop-blur-md z-40 px-4 flex items-center justify-between">
         <div className="flex items-center gap-2">
            <img src={iconPath} alt="Icon" className="w-6 h-6" />
            <span className="font-bold text-sm">Setlist Manager Pro</span>
         </div>
         {/* Use MainMenu normally here for mobile */}
         <MainMenu />
      </header>

      {/* Mobile Content Area */}
      <main className="container mx-auto max-w-5xl p-4 pt-20 md:p-8 md:pt-8">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>

      {/* Mobile Metronome - Above Nav */}
      <div className="md:hidden">
        <MetronomeControls variant="mobile" className="bottom-[calc(90px+env(safe-area-inset-bottom))]" />
      </div>

      {/* Mobile Bottom Navigation (Floating FAB Style) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl border-t z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-end justify-between px-2 h-16 relative">
            
            {/* Left Items */}
            {mobileNavItems.slice(0, 2).map((item) => (
                <Link
                    key={item.label}
                    to={item.path!}
                    className={cn(
                        "flex flex-col items-center justify-center gap-1 flex-1 h-full pb-2 transition-colors",
                        location.pathname === item.path ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <item.icon className="w-5 h-5" />
                    <span className="text-[10px] font-medium">{item.label}</span>
                </Link>
            ))}

            {/* Spacer for FAB */}
            <div className="w-16 shrink-0" />

            {/* Right Items */}
            {mobileNavItems.slice(3, 5).map((item) => (
                <Link
                    key={item.label}
                    to={item.path!}
                    className={cn(
                        "flex flex-col items-center justify-center gap-1 flex-1 h-full pb-2 transition-colors",
                        location.pathname === item.path ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <item.icon className="w-5 h-5" />
                    <span className="text-[10px] font-medium">{item.label}</span>
                </Link>
            ))}

            {/* Floating Perform Button */}
            <div className="absolute left-1/2 -top-6 -translate-x-1/2">
                <Link to="/performance">
                    <div className={cn(
                        "w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 border-4 border-background",
                        location.pathname === "/performance" 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-primary text-primary-foreground"
                    )}>
                        <Play className="w-6 h-6 ml-1 fill-current" />
                    </div>
                    <div className={cn(
                        "text-[10px] font-medium text-center mt-1 transition-colors",
                        location.pathname === "/performance" ? "text-primary" : "text-muted-foreground"
                    )}>
                        Perform
                    </div>
                </Link>
            </div>

        </div>
      </nav>

      <AlertDialog open={showSignOutConfirm} onOpenChange={setShowSignOutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign Out</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to sign out? This will clear your local data cache.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut} className="bg-destructive hover:bg-destructive/90">Sign Out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AppLayout;