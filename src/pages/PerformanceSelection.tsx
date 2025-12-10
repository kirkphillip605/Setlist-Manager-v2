import AppLayout from "@/components/AppLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarDays, ChevronRight, Music2, Users, Lock } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSyncedSetlists, useSyncedGigs } from "@/hooks/useSyncedData";

const PerformanceSelection = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"gig" | "practice" | null>(null);

  const { data: setlists = [] } = useSyncedSetlists();
  const { data: gigs = [] } = useSyncedGigs();

  // Filter Gigs: Today and Future
  const upcomingGigs = gigs.filter(g => new Date(g.date) >= new Date(new Date().setDate(new Date().getDate() - 1)));

  const handleGigSelect = (gig: any) => {
    if (!gig.setlist_id) {
        toast.error("This gig has no setlist attached!");
        return;
    }
    // Pass gigId via query param
    navigate(`/performance/${gig.setlist_id}?gigId=${gig.id}`);
  };

  return (
    <AppLayout>
      <div className="space-y-8 pb-20 max-w-4xl mx-auto">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Performance Mode</h1>
          <p className="text-muted-foreground text-lg">Choose your mode to begin.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <Card 
                className="cursor-pointer hover:border-primary hover:bg-primary/5 transition-all group border-2"
                onClick={() => setMode("gig")}
            >
                <CardHeader className="text-center pb-2">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <CalendarDays className="w-8 h-8" />
                    </div>
                    <CardTitle className="text-2xl">Start Gig</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground px-6 pb-6">
                    Play an upcoming show. Optimized for live performance with setlist management.
                </CardContent>
            </Card>

            <Card 
                className="cursor-pointer hover:border-secondary hover:bg-secondary/20 transition-all group border-2"
                onClick={() => setMode("practice")}
            >
                <CardHeader className="text-center pb-2">
                    <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4 text-foreground group-hover:bg-secondary-foreground group-hover:text-secondary transition-colors">
                        <Music2 className="w-8 h-8" />
                    </div>
                    <CardTitle className="text-2xl">Start Practice</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground px-6 pb-6">
                    Rehearse any setlist from your library. Includes metronome and editing tools.
                </CardContent>
            </Card>
        </div>

        {/* Selection Dialog */}
        <Dialog open={!!mode} onOpenChange={() => setMode(null)}>
            <DialogContent className="max-w-md h-[60vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle>{mode === "gig" ? "Select Gig" : "Select Setlist"}</DialogTitle>
                </DialogHeader>
                
                <ScrollArea className="flex-1">
                    <div className="divide-y">
                        {mode === "gig" ? (
                             upcomingGigs.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground">No upcoming gigs found.</div>
                             ) : (
                                upcomingGigs.map(gig => (
                                    <div 
                                        key={gig.id} 
                                        className="p-4 hover:bg-accent cursor-pointer flex items-center justify-between group"
                                        onClick={() => handleGigSelect(gig)}
                                    >
                                        <div>
                                            <div className="font-bold">{gig.name}</div>
                                            <div className="text-sm text-muted-foreground">{new Date(gig.date).toLocaleDateString()}</div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground" />
                                    </div>
                                ))
                             )
                        ) : (
                            setlists.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground">No setlists found.</div>
                            ) : (
                                setlists.sort((a,b) => a.name.localeCompare(b.name)).map(list => (
                                    <div 
                                        key={list.id} 
                                        className="p-4 hover:bg-accent cursor-pointer flex items-center justify-between group"
                                        onClick={() => navigate(`/performance/${list.id}`)}
                                    >
                                        <div>
                                            <div className="font-bold flex items-center gap-2">
                                                {list.is_personal ? <Lock className="w-3 h-3 text-muted-foreground" /> : <Users className="w-3 h-3 text-muted-foreground" />}
                                                {list.name}
                                            </div>
                                            <div className="text-xs text-muted-foreground flex gap-2 mt-1">
                                                {list.sets.reduce((acc, s) => acc + s.songs.length, 0)} Songs
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground" />
                                    </div>
                                ))
                            )
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default PerformanceSelection;