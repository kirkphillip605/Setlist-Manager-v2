import AppLayout from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSongs } from "@/lib/storage";
import { Song } from "@/types";
import { Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const SongList = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setSongs(getSongs());
  }, []);

  const filteredSongs = songs.filter(
    (song) =>
      song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Songs</h1>
            <p className="text-muted-foreground">Manage your repertoire.</p>
          </div>
          <Button asChild>
            <Link to="/songs/new">
              <Plus className="mr-2 h-4 w-4" /> Add Song
            </Link>
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title or artist..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="grid gap-4">
          {filteredSongs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchTerm ? "No songs found matching your search." : "No songs added yet."}
            </div>
          ) : (
            filteredSongs.map((song) => (
              <Link key={song.id} to={`/songs/${song.id}`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{song.title}</h3>
                      <p className="text-sm text-muted-foreground">{song.artist}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {song.key && (
                        <div className="hidden sm:flex flex-col items-end">
                          <span className="text-xs text-muted-foreground uppercase">Key</span>
                          <span className="font-medium">{song.key}</span>
                        </div>
                      )}
                      {song.tempo && (
                        <div className="hidden sm:flex flex-col items-end">
                          <span className="text-xs text-muted-foreground uppercase">BPM</span>
                          <span className="font-medium">{song.tempo}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default SongList;