import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { Music, ListMusic, CalendarDays, ArrowRight, Eye, Play } from "lucide-react";
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

        {/* GIGS CARD */}
        <Card className="border-l-4 border-l-primary shadow-md overflow-hidden">
            <CardHeader className="bg-muted/10 pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-primary" />
                    Upcoming Gigs
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
                {/* Today's Gig */}
                {todaysGig ? (
                    <div 
                        className="bg-primary/10 border border-primary/20 p-4 rounded-lg flex items-center justify-between cursor-pointer hover:bg-primary/20 transition-colors"
                        onClick={() => navigate(`/gigs/${todaysGig.id}`)}
                    >
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Badge variant="default" className="animate-pulse">HAPPENING TODAY</Badge>
                            </div>
                            <div className="font-bold text-xl">{todaysGig.name}</div>
                            <div className="text-sm text-muted-foreground">{todaysGig.venue_name || "No Venue"} • {format(parseISO(todaysGig.start_time), "h:mm a")}</div>
                        </div>
                        <ArrowRight className="h-6 w-6 text-primary" />
                    </div>
                ) : upcomingGigs.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground">No upcoming gigs found.</div>
                )}

                {/* Next Gigs List */}
                {nextGigs.length > 0 && (
                    <div className="space-y-2">
                        {nextGigs.map(gig => (
                            <div 
                                key={gig.id} 
                                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
                                onClick={() => navigate(`/gigs/${gig.id}`)}
                            >
                                <div>
                                    <div className="font-semibold">{gig.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {format(parseISO(gig.start_time), "EEE, MMM d")} • {gig.venue_name}
                                    </div>
                                </div>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
                
                <Button asChild size="sm" variant="outline" className="w-full mt-2">
                    <Link to="/gigs">View All Gigs</Link>
                </Button>
            </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
             {/* SONGS CARD */}
             <Card>
                <CardHeader className="bg-muted/10 pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                         <Music className="h-4 w-4" /> Recently Added Songs
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="space-y-2">
                        {recentSongs.length === 0 ? (
                            <div className="text-muted-foreground text-sm text-center py-4">No songs added yet.</div>
                        ) : (
                            recentSongs.map(song => (
                                <div 
                                    key={song.id} 
                                    className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer group"
                                    onClick={() => navigate(`/songs/${song.id}`)}
                                >
                                    <div className="bg-secondary h-10 w-10 rounded shrink-0">
                                        <AlbumArtwork 
                                            src={song.cover_url} 
                                            alt={song.title} 
                                            containerClassName="w-full h-full rounded"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate text-sm">{song.title}</div>
                                        <div className="text-xs text-muted-foreground truncate">{song.artist}</div>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            ))
                        )}
                    </div>
                    <Button asChild size="sm" variant="ghost" className="w-full mt-4 text-muted-foreground">
                        <Link to="/songs">View Music Library</Link>
                    </Button>
                </CardContent>
            </Card>

            {/* SETLISTS CARD */}
            <Card>
                <CardHeader className="bg-muted/10 pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                         <ListMusic className="h-4 w-4" /> Setlists
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-primary/5 rounded-lg p-4 text-center border border-primary/10">
                            <div className="text-2xl font-bold text-primary">{bandSetlists.length}</div>
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Band</div>
                        </div>
                        <div className="bg-secondary/50 rounded-lg p-4 text-center border border-border">
                            <div className="text-2xl font-bold">{personalSetlists.length}</div>
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Personal</div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Button asChild className="w-full justify-between" variant="default">
                            <Link to="/setlists">
                                View Band Setlists <ArrowRight className="h-4 w-4" />
                            </Link>
                        </Button>
                        <Button asChild className="w-full justify-between" variant="secondary">
                            <Link to="/setlists">
                                View Personal Setlists <ArrowRight className="h-4 w-4" />
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;