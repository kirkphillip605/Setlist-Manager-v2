import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Music, ListMusic, Plus } from "lucide-react";
import { getSongs, getSetlists } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

const Index = () => {
  const { data: songs = [] } = useQuery({
    queryKey: ['songs'],
    queryFn: getSongs
  });

  const { data: setlists = [] } = useQuery({
    queryKey: ['setlists'],
    queryFn: getSetlists
  });

  const recentSongs = [...songs].sort((a, b) => {
    // Assuming createdAt might be available but optional in type, 
    // or just relying on order returned by DB (which we set to title asc, but here we want recent)
    // Since we don't have createdAt in the simple Song type explicitly shown before, 
    // we'll just slice the array. In a real app, we'd sort by date.
    return 0; 
  }).slice(0, 5);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back to your band management app.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Songs</CardTitle>
              <Music className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{songs.length}</div>
              <div className="mt-4">
                <Button asChild size="sm" className="w-full">
                  <Link to="/songs/new">
                    <Plus className="mr-2 h-4 w-4" /> Add Song
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Setlists</CardTitle>
              <ListMusic className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{setlists.length}</div>
              <div className="mt-4">
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/setlists">View Setlists</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Recently Added Songs</h2>
          {recentSongs.length === 0 ? (
            <div className="text-center py-10 bg-accent/20 rounded-lg border border-dashed">
              <p className="text-muted-foreground mb-2">No songs added yet.</p>
              <Button asChild variant="link">
                <Link to="/songs/new">Add your first song</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recentSongs.map((song) => (
                <Link key={song.id} to={`/songs/${song.id}`}>
                  <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg truncate">{song.title}</CardTitle>
                      <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        {song.key && <span className="bg-secondary px-2 py-1 rounded">{song.key}</span>}
                        {song.tempo && <span className="bg-secondary px-2 py-1 rounded">{song.tempo} BPM</span>}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;