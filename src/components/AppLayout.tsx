import { Link, useLocation } from "react-router-dom";
import { Music, ListMusic, Plus, Home } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 flex-col border-r bg-card px-4 py-6">
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="bg-primary text-primary-foreground p-2 rounded-lg">
            <Music className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">BandMate</h1>
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium",
                location.pathname === item.path
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile Content Area */}
      <main className="container mx-auto max-w-5xl p-4 md:p-8 animate-in fade-in duration-500">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-background/80 backdrop-blur-lg px-6 py-3 flex justify-between items-center z-50">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center gap-1",
              location.pathname === item.path
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default AppLayout;