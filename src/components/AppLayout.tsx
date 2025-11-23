import { Link, useLocation } from "react-router-dom";
import { Music, ListMusic, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { MetronomeControls } from "./MetronomeControls";
import { ModeToggle } from "./mode-toggle";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const location = useLocation();

  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Music, label: "Songs", path: "/songs" },
    { icon: ListMusic, label: "Setlists", path: "/setlists" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pb-[140px] md:pb-0 md:pl-64 transition-colors duration-300">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 flex-col border-r bg-card/50 backdrop-blur-xl px-4 py-6 z-20">
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground p-2 rounded-xl shadow-lg shadow-primary/20">
              <Music className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">BandMate</h1>
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

        {/* Desktop Metronome */}
        <MetronomeControls variant="desktop" />
      </aside>

      {/* Mobile Header (Top Bar) */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 border-b bg-background/80 backdrop-blur-md z-40 px-4 flex items-center justify-between">
         <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-lg">
              <Music className="w-4 h-4" />
            </div>
            <span className="font-bold text-lg">BandMate</span>
         </div>
         <ModeToggle />
      </header>

      {/* Mobile Content Area */}
      <main className="container mx-auto max-w-5xl p-4 pt-20 md:p-8 md:pt-8 animate-in fade-in duration-500">
        {children}
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