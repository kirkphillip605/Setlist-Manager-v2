import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getSetlists, getGigs } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Loader2, PlayCircle, Music2, CalendarDays, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

const PerformanceSelection = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"gig" | "practice" | null>(null);

  const { data: setlists = [], isLoading: loadingSetlists } = useQuery({ queryKey: ['setlists'], queryFn: getSetlists });
  const { data: gigs = [], isLoading: loadingGigs } = useQuery({ queryKey: ['gigs'], queryFn: getGigs });

  const upcomingGigs = gigs.filter(g => new Date(g.date) >= new Date(new Date().setDate(new Date().getDate() - 1))); // Show today + future

  const handleGigSelect = (setlistId: string | null) => {
    if (!setlistId) {
        toast.error("This gig has no setlist attached!");
        return;
    }
    navigate(`/performance/${setlistId}`);
  };

  return (
    <AppLayout>
      <div className="space-y-8 pb-20 max-w-4xl mx-auto">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Performance Mode</h1>
          <p className="text-muted-foreground text-lg">Choose your mode to begin.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 pt-4">
            <Card 
                className="hover:border-primary transition-all cursor-pointer group hover:shadow-lg hover:-translate-y-1 duration-200"
                onClick={() => setMode("gig")}
            >
                <CardHeader>
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <CalendarDays className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-2xl">Start Gig</CardTitle>
                    <CardDescription>Play an upcoming show. Select from your Gigs list.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded">
                        Recommended for live shows. Requires a configured Gig.
                    </div>
                </CardContent>
            </Card>

            <Card 
                className="hover:border-secondary transition-all cursor-pointer group hover:shadow-lg hover:-translate-y-1 duration-200"
                onClick={() => setMode("practice")}
            >
                <CardHeader>
                    <div className="w-12 h-12 bg-secondary/30 rounded-full flex items-center justify-center mb-4 text-foreground group-hover:bg-secondary group-hover:text-secondary-foreground transition-colors">
                        <Music2 className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-2xl">Start Practice</CardTitle>
                    <CardDescription>Rehearse any setlist from your library.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded">
                        Access all Band and Personal setlists.
                    </div>
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
                                        onClick={() => handleGigSelect(gig.setlist_id)}
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
                                            <div className="font-bold">{list.name}</div>
                                            <div className="text-xs text-muted-foreground flex gap-2">
                                                {list.is_personal ? "Personal" : "Band"} 
                                                <span>•</span> 
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