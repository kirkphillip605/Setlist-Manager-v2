import { Link, useLocation, useNavigate } from "react-router-dom";
import { Music, ListMusic, Home, User, LogOut, Shield, PlayCircle, CalendarDays, PanelLeftClose, PanelLeftOpen } from "lucide-react";
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

  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: CalendarDays, label: "Gigs", path: "/gigs" },
    { icon: ListMusic, label: "Setlists", path: "/setlists" },
    { icon: Music, label: "Songs", path: "/songs" },
    { icon: PlayCircle, label: "Perform", path: "/performance" },
  ];

  if (isAdmin) {
    navItems.push({ icon: Shield, label: "Admin", path: "/admin/users" });
  }

  return (
    <div className={cn(
        "min-h-screen bg-background text-foreground transition-all duration-300",
        "pb-[140px] md:pb-0", // Mobile bottom spacing
        isSidebarCollapsed ? "md:pl-[80px]" : "md:pl-64" // Sidebar width adjustment
    )}>
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden md:flex fixed left-0 top-0 h-full flex-col border-r bg-card/50 backdrop-blur-xl z-20 transition-all duration-300",
        isSidebarCollapsed ? "w-[80px] px-2" : "w-64 px-4"
      )}>
        <div className={cn("flex items-center mb-8 pt-6", isSidebarCollapsed ? "justify-center flex-col gap-4" : "justify-between px-2")}>
          <div className="flex items-center gap-2">
            <img src={iconPath} alt="Icon" className="w-6 h-6" />
            {!isSidebarCollapsed && <img src={logoPath} alt="Bad Habits Logo" className="h-6" />}
          </div>
          
          <div className="flex flex-col gap-2">
            {!isSidebarCollapsed && <div className="flex items-center gap-1"><SyncStatusButton /><ModeToggle /></div>}
            {isSidebarCollapsed && <ModeToggle />}
            
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            >
                {isSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        
        <nav className="space-y-2 flex-1">
          {navItems.map((item) => (
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

        {/* User Menu */}
        <div className="mb-4">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className={cn("w-full hover:bg-accent", isSidebarCollapsed ? "justify-center px-0" : "justify-start gap-2 px-2")}>
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

        {/* Desktop Metronome */}
        {!isSidebarCollapsed && <MetronomeControls variant="desktop" />}
      </aside>

      {/* Mobile Header (Top Bar) */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 border-b bg-background/80 backdrop-blur-md z-40 px-4 flex items-center justify-between">
         <div className="flex items-center gap-2">
            <img src={iconPath} alt="Icon" className="w-6 h-6" />
            <span className="font-bold text-sm">Bad Habits</span>
         </div>
         <div className="flex items-center gap-1">
             <SyncStatusButton />
             <ModeToggle />
             <Button variant="ghost" size="icon" onClick={() => navigate("/profile")}>
                <User className="w-5 h-5" />
             </Button>
         </div>
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

      {/* Mobile Metronome - Renders above bottom nav */}
      <div className="md:hidden">
        <MetronomeControls variant="mobile" />
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-background/90 backdrop-blur-xl px-2 py-2 pb-safe flex justify-between items-center z-50 h-[60px]">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center justify-center gap-1 w-full h-full rounded-lg transition-colors px-1",
              location.pathname === item.path
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className={cn("w-5 h-5", location.pathname === item.path && "fill-current")} />
            <span className="text-[10px] font-medium truncate w-full text-center">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default AppLayout;