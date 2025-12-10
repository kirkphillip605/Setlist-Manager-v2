import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { Music, ListMusic, Plus, CalendarDays, Lock, Globe, ArrowRight, Eye } from "lucide-react";
import { useSyncedSongs, useSyncedSetlists, useSyncedGigs } from "@/hooks/useSyncedData";

const Index = () => {
  const navigate = useNavigate();

  const { data: songs = [] } = useSyncedSongs();
  const { data: setlists = [] } = useSyncedSetlists();
  const { data: gigs = [] } = useSyncedGigs();

  const bandSetlists = setlists.filter(s => !s.is_personal);
  const personalSetlists = setlists.filter(s => s.is_personal);
  
  const today = new Date().toISOString().split('T')[0];
  const upcomingGigs = gigs.filter(g => g.date >= today).sort((a,b) => a.date.localeCompare(b.date));
  const todaysGig = gigs.find(g => g.date === today);

  return (
    <AppLayout>
      <div className="space-y-6 pb-20">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back.</p>
        </div>

        {/* Gigs Card (Top Priority) */}
        <Card className="border-l-4 border-l-primary shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-primary" />
                    Gigs
                </CardTitle>
                <div className="text-2xl font-bold">{upcomingGigs.length} <span className="text-sm font-normal text-muted-foreground">Upcoming</span></div>
            </CardHeader>
            <CardContent className="space-y-4">
                {todaysGig && (
                    <div 
                        className="bg-primary/10 border border-primary/20 p-4 rounded-lg flex items-center justify-between cursor-pointer hover:bg-primary/20 transition-colors"
                        onClick={() => navigate(`/gigs/${todaysGig.id}`)}
                    >
                        <div>
                            <div className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Happening Today</div>
                            <div className="font-bold text-lg">{todaysGig.name}</div>
                            <div className="text-sm text-muted-foreground">{todaysGig.venue_name || "No Venue Set"}</div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-primary" />
                    </div>
                )}
                
                <div className="grid grid-cols-2 gap-3">
                    <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                        <Link to="/gigs">
                            <Plus className="mr-2 h-4 w-4" /> New Gig
                        </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="border-primary text-primary hover:bg-primary/5">
                        <Link to="/gigs">
                             <Eye className="mr-2 h-4 w-4" /> View All
                        </Link>
                    </Button>
                </div>
            </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
             {/* Songs Card */}
             <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                         <Music className="h-4 w-4" /> Songs
                    </CardTitle>
                    <div className="text-2xl font-bold">{songs.length}</div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                            <Link to="/songs/new">
                                <Plus className="mr-2 h-4 w-4" /> Add
                            </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline" className="border-primary text-primary hover:bg-primary/5">
                            <Link to="/songs">
                                <Eye className="mr-2 h-4 w-4" /> View
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Band Setlists */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                         <Globe className="h-4 w-4" /> Band Setlists
                    </CardTitle>
                    <div className="text-2xl font-bold">{bandSetlists.length}</div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                            <Link to="/setlists">
                                <Plus className="mr-2 h-4 w-4" /> Create
                            </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline" className="border-primary text-primary hover:bg-primary/5">
                            <Link to="/setlists">
                                <Eye className="mr-2 h-4 w-4" /> View
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Private Setlists */}
             <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                         <Lock className="h-4 w-4" /> Private Setlists
                    </CardTitle>
                    <div className="text-2xl font-bold">{personalSetlists.length}</div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                            <Link to="/setlists">
                                <Plus className="mr-2 h-4 w-4" /> Create
                            </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline" className="border-primary text-primary hover:bg-primary/5">
                            <Link to="/setlists">
                                <Eye className="mr-2 h-4 w-4" /> View
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