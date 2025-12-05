import { Link, useLocation, useNavigate } from "react-router-dom";
import { Music, ListMusic, Home, User, LogOut, Shield, PlayCircle, ChevronLeft, ChevronRight } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        setIsAdmin(data?.role === 'admin');
      }
    };
    checkAdmin();
  }, []);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
      console.error(error);
    }
    // No manual navigate needed; App.tsx listens to state change and redirects
  };

  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Music, label: "Songs", path: "/songs" },
    { icon: ListMusic, label: "Setlists", path: "/setlists" },
    { icon: PlayCircle, label: "Perform", path: "/performance" },
  ];

  if (isAdmin) {
    navItems.push({ icon: Shield, label: "Admin", path: "/admin" });
  }

  return (
    <div className={cn(
        "min-h-screen bg-background text-foreground pb-[140px] md:pb-0 transition-all duration-300",
        isCollapsed ? "md:pl-[80px]" : "md:pl-64"
    )}>
      {/* Desktop Sidebar */}
      <aside className={cn(
          "hidden md:flex fixed left-0 top-0 h-full flex-col border-r bg-card/50 backdrop-blur-xl z-20 transition-all duration-300",
          isCollapsed ? "w-[80px] px-2" : "w-64 px-4"
      )}>
        {/* Toggle Button */}
        <Button
            variant="ghost"
            size="icon"
            className="absolute -right-3 top-6 h-6 w-6 rounded-full border bg-background shadow-md hover:bg-accent z-50 text-muted-foreground"
            onClick={() => setIsCollapsed(!isCollapsed)}
        >
            {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </Button>

        <div className={cn(
            "flex items-center mb-8 py-6 transition-all", 
            isCollapsed ? "flex-col justify-center gap-4" : "justify-between px-2"
        )}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="shrink-0">
               <img src="/setlist-icon.png" alt="Icon" className="w-10 h-10 object-contain" />
            </div>
            <div className={cn("transition-opacity duration-200", isCollapsed ? "opacity-0 w-0 hidden" : "opacity-100")}>
                <h1 className="text-lg font-bold tracking-tight leading-none whitespace-nowrap">SetlistPro</h1>
                <p className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">Manage Your Gigs</p>
            </div>
          </div>
          {!isCollapsed && <ModeToggle />}
        </div>
        
        {/* If collapsed, show mode toggle in a cleaner way if needed, or just hide it/move it to bottom. 
            For now, I'll keep it hidden in the top bar when collapsed to save space, or I could move it. 
            Let's put it at the bottom or just hide it. The previous design had it in the header row.
            Let's add it to the bottom if collapsed, or just leave it. 
            Actually, let's just render it centered if collapsed. 
        */}
        {isCollapsed && (
             <div className="flex justify-center mb-4">
                 <ModeToggle />
             </div>
        )}
        
        <nav className="space-y-2 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium",
                location.pathname === item.path || (item.path === '/admin' && location.pathname.startsWith('/admin'))
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "hover:bg-accent hover:text-accent-foreground text-muted-foreground",
                isCollapsed && "justify-center px-2"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* User Menu */}
        <div className="mb-4">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className={cn("w-full gap-2 px-2 hover:bg-accent", isCollapsed ? "justify-center" : "justify-start")}>
                        <User className="w-5 h-5 shrink-0" />
                        {!isCollapsed && <span>Profile & Settings</span>}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isCollapsed ? "center" : "end"} side={isCollapsed ? "right" : "top"} className="w-56">
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
        <MetronomeControls variant="desktop" minimized={isCollapsed} />
      </aside>

      {/* Mobile Header (Top Bar) */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 border-b bg-background/80 backdrop-blur-md z-40 px-4 flex items-center justify-between">
         <div className="flex items-center gap-2">
            <img src="/setlist-icon.png" alt="Icon" className="w-8 h-8 object-contain" />
            <span className="font-bold text-lg">SetlistPro</span>
         </div>
         <div className="flex items-center gap-2">
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-background/90 backdrop-blur-xl px-6 py-2 pb-safe flex justify-between items-center z-50 h-[60px]">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center justify-center gap-1 w-16 h-full rounded-lg transition-colors",
              location.pathname === item.path || (item.path === '/admin' && location.pathname.startsWith('/admin'))
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className={cn("w-6 h-6", location.pathname === item.path && "fill-current")} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default AppLayout;