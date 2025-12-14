import { Link, useLocation, useNavigate } from "react-router-dom";
import { Music, ListMusic, Home, User, LogOut, Shield, PlayCircle, CalendarDays, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { MetronomeControls } from "./MetronomeControls";
import { ModeToggle } from "./mode-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
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

  // Order: Dashboard, Songs, Perform, Setlists, Gigs
  const navItems = [
    { icon: Home, label: "Dashboard", path: "/" },
    { icon: Music, label: "Songs", path: "/songs" },
    { icon: Play, label: "Perform", path: "/performance", isSpecial: true },
    { icon: ListMusic, label: "Setlists", path: "/setlists" },
    { icon: CalendarDays, label: "Gigs", path: "/gigs" },
  ];

  const desktopNavItems = [
    ...navItems,
    ...(isAdmin ? [{ icon: Shield, label: "Admin", path: "/admin/users" }] : [])
  ];

  return (
    <div className={cn(
        "min-h-screen bg-background text-foreground transition-all duration-300",
        "pb-[calc(90px+env(safe-area-inset-bottom))] md:pb-0", // Increased bottom padding for floating FAB
        isSidebarCollapsed ? "md:pl-[80px]" : "md:pl-64"
    )}>
      {isAdmin && <PendingApprovalNotifier />}

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

        <div className={cn("flex flex-col mb-6 pt-6 transition-all", isSidebarCollapsed ? "items-center px-0" : "px-4")}>
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
        
        <nav className="space-y-2 flex-1 px-3">
          {desktopNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-lg transition-all duration-200 font-medium",
                isSidebarCollapsed ? "justify-center p-3" : "px-3 py-2.5 text-sm",
                location.pathname === item.path
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
              )}
              title={isSidebarCollapsed ? item.label : undefined}
            >
              <item.icon className={cn("shrink-0", isSidebarCollapsed ? "w-5 h-5" : "w-4 h-4")} />
              {!isSidebarCollapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="mb-4 px-3">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className={cn("w-full hover:bg-accent border border-transparent", isSidebarCollapsed ? "justify-center px-0" : "justify-start gap-2 px-2 border-border/40")}>
                        <User className="w-4 h-4" />
                        {!isSidebarCollapsed && <span>Profile</span>}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/profile")}>
                        <User className="mr-2 h-4 w-4" /> Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                        <LogOut className="mr-2 h-4 w-4" /> Log out
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>

        {!isSidebarCollapsed && <MetronomeControls variant="desktop" />}
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 border-b bg-background/80 backdrop-blur-md z-40 px-4 flex items-center justify-between">
         <div className="flex items-center gap-2">
            <img src={iconPath} alt="Icon" className="w-6 h-6" />
            <span className="font-bold text-sm">Setlist Manager Pro</span>
         </div>
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
            {navItems.slice(0, 2).map((item) => (
                <Link
                    key={item.path}
                    to={item.path}
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
            {navItems.slice(3).map((item) => (
                <Link
                    key={item.path}
                    to={item.path}
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
    </div>
  );
};

export default AppLayout;