import { Link, useLocation, useNavigate } from "react-router-dom";
import { Music, ListMusic, Home, User, LogOut, Shield, PlayCircle } from "lucide-react";
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

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

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
    await supabase.auth.signOut();
    navigate("/login");
  };

  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Music, label: "Songs", path: "/songs" },
    { icon: ListMusic, label: "Setlists", path: "/setlists" },
    { icon: PlayCircle, label: "Perform", path: "/performance" },
  ];

  if (isAdmin) {
    navItems.push({ icon: Shield, label: "Admin", path: "/admin/users" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-[140px] md:pb-0 md:pl-64 transition-colors duration-300">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 flex-col border-r bg-card/50 backdrop-blur-xl px-4 py-6 z-20">
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground p-2 rounded-xl shadow-lg shadow-primary/20">
              <Music className="w-5 h-5" />
            </div>
            <div>
                <h1 className="text-sm font-bold tracking-tight leading-none">Bad Habits</h1>
                <p className="text-[10px] text-muted-foreground font-medium">Setlist Management</p>
            </div>
          </div>
          <ModeToggle />
        </div>
        
        <nav className="space-y-2 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium",
                location.pathname === item.path
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User Menu */}
        <div className="mb-4">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="w-full justify-start gap-2 px-2 hover:bg-accent">
                        <User className="w-4 h-4" />
                        <span>Profile & Settings</span>
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
        <MetronomeControls variant="desktop" />
      </aside>

      {/* Mobile Header (Top Bar) */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 border-b bg-background/80 backdrop-blur-md z-40 px-4 flex items-center justify-between">
         <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-lg">
              <Music className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm">Bad Habits</span>
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
              location.pathname === item.path
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