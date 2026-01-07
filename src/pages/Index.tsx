import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { Music, ListMusic, CalendarDays, ArrowRight, Eye, Play, ChevronRight } from "lucide-react";
import { useSyncedSongs, useSyncedSetlists, useSyncedGigs } from "@/hooks/useSyncedData";
import { Badge } from "@/components/ui/badge";
import { AlbumArtwork } from "@/components/AlbumArtwork";
import { format, isSameDay, parseISO } from "date-fns";

const Index = () => {
  const navigate = useNavigate();

  const { data: songs = [] } = useSyncedSongs();
  const { data: setlists = [] } = useSyncedSetlists();
  const { data: gigs = [] } = useSyncedGigs();

  const bandSetlists = setlists.filter(s => !s.is_personal);
  const personalSetlists = setlists.filter(s => s.is_personal);
  
  // Date Logic
  const now = new Date();
  
  // Filter Gigs - Using ISO string comparison is safe for standard ordering
  const upcomingGigs = gigs
    .filter(g => g.start_time >= now.toISOString() || isSameDay(parseISO(g.start_time), now))
    .sort((a,b) => a.start_time.localeCompare(b.start_time));
    
  const todaysGig = upcomingGigs.find(g => isSameDay(parseISO(g.start_time), now));
  // Get next 2 gigs that aren't today
  const nextGigs = upcomingGigs.filter(g => !isSameDay(parseISO(g.start_time), now)).slice(0, 2);

  // Recent Songs (Last 3 created)
  const recentSongs = [...songs]
    .sort((a: any, b: any) => (b.created_at || "").localeCompare(a.created_at || ""))
    .slice(0, 3);

  return (
    <AppLayout>
      <div className="space-y-6 pb-20">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Band Overview</p>
        </div>

        {/* 1. SETLISTS CARD (Main Focus) */}
        <Card className="border-l-4 border-l-primary shadow-md overflow-hidden bg-gradient-to-br from-card to-secondary/20">
            <CardHeader className="bg-muted/10 pb-3 border-b">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                     <ListMusic className="h-5 w-5 text-primary" /> Setlists
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-background rounded-xl p-4 text-center border shadow-sm">
                        <div className="text-3xl font-bold text-primary">{bandSetlists.length}</div>
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Band</div>
                    </div>
                    <div className="bg-background/50 rounded-xl p-4 text-center border border-dashed">
                        <div className="text-3xl font-bold">{personalSetlists.length}</div>
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Personal</div>
                    </div>
                </div>

                <div className="space-y-3">
                    <Button asChild className="w-full justify-between h-12 text-base shadow-sm hover:shadow-md transition-all" variant="default">
                        <Link to="/setlists">
                            View Band Setlists <ArrowRight className="h-5 w-5" />
                        </Link>
                    </Button>
                    <Button asChild className="w-full justify-between h-12 text-base border-primary/20 hover:bg-primary/5" variant="outline">
                        <Link to="/setlists?tab=personal">
                            View Personal Setlists <ArrowRight className="h-5 w-5" />
                        </Link>
                    </Button>
                </div>
            </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
            {/* 2. GIGS CARD */}
            <Card className="h-full flex flex-col">
                <CardHeader className="bg-muted/10 pb-3 border-b">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        Upcoming Gigs
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4 flex-1">
                    {/* Today's Gig */}
                    {todaysGig ? (
                        <div 
                            className="bg-primary/10 border border-primary/20 p-4 rounded-xl flex items-center justify-between cursor-pointer hover:bg-primary/20 transition-colors shadow-sm"
                            onClick={() => navigate(`/gigs/${todaysGig.id}`)}
                        >
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="default" className="animate-pulse shadow-sm">HAPPENING TODAY</Badge>
                                </div>
                                <div className="font-bold text-xl">{todaysGig.name}</div>
                                <div className="text-sm text-muted-foreground">{todaysGig.venue_name || "No Venue"} • {format(parseISO(todaysGig.start_time), "h:mm a")}</div>
                            </div>
                            <ArrowRight className="h-6 w-6 text-primary" />
                        </div>
                    ) : upcomingGigs.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                            No upcoming gigs found.
                        </div>
                    )}

                    {/* Next Gigs List */}
                    {nextGigs.length > 0 && (
                        <div className="space-y-2">
                            {nextGigs.map(gig => (
                                <div 
                                    key={gig.id} 
                                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                                    onClick={() => navigate(`/gigs/${gig.id}`)}
                                >
                                    <div>
                                        <div className="font-semibold">{gig.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {format(parseISO(gig.start_time), "EEE, MMM d")} • {gig.venue_name}
                                        </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                </div>
                            ))}
                        </div>
                    )}
                    
                    <Button asChild size="sm" variant="ghost" className="w-full mt-auto">
                        <Link to="/gigs">View All Gigs</Link>
                    </Button>
                </CardContent>
            </Card>

             {/* 3. SONGS CARD */}
             <Card className="h-full flex flex-col">
                <CardHeader className="bg-muted/10 pb-3 border-b">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                         <Music className="h-4 w-4" /> Recently Added
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 flex-1">
                    <div className="space-y-2">
                        {recentSongs.length === 0 ? (
                            <div className="text-muted-foreground text-sm text-center py-8 bg-muted/20 rounded-xl border border-dashed">No songs added yet.</div>
                        ) : (
                            recentSongs.map(song => (
                                <div 
                                    key={song.id} 
                                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 cursor-pointer group transition-colors border border-transparent hover:border-border"
                                    onClick={() => navigate(`/songs/${song.id}`)}
                                >
                                    <div className="w-10 h-10 shrink-0">
                                        <AlbumArtwork 
                                            src={song.cover_url} 
                                            alt={song.title} 
                                            containerClassName="w-full h-full rounded shadow-sm"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate text-sm">{song.title}</div>
                                        <div className="text-xs text-muted-foreground truncate">{song.artist}</div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            ))
                        )}
                    </div>
                    <Button asChild size="sm" variant="ghost" className="w-full mt-4 text-muted-foreground">
                        <Link to="/songs">View Library</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;