import AppLayout from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getSongs, deleteSong } from "@/lib/api";
import { Plus, Search, Loader2, Trash2, Edit, Music } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, PanInfo, useAnimation } from "framer-motion";
import { toast } from "sonner";
import { Song } from "@/types";

// Swipeable Item Component
const SongListItem = ({ song, onDelete }: { song: Song; onDelete: (id: string) => void }) => {
  const navigate = useNavigate();
  const controls = useAnimation();
  
  const handleDragEnd = async (event: any, info: PanInfo) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    // Swipe Left to Delete (threshold -100)
    if (offset < -100 || velocity < -500) {
      if (confirm(`Delete "${song.title}"?`)) {
        onDelete(song.id);
      } else {
        controls.start({ x: 0 });
      }
    } 
    // Swipe Right to Edit (threshold 100)
    else if (offset > 100 || velocity > 500) {
      navigate(`/songs/${song.id}/edit`);
    } 
    else {
      controls.start({ x: 0 });
    }
  };

  return (
    <div className="relative mb-3 group">
      {/* Background Actions Layer */}
      <div className="absolute inset-0 flex items-center justify-between rounded-xl overflow-hidden">
        <div className="h-full w-1/2 bg-blue-500/10 flex items-center justify-start pl-6">
          <Edit className="text-blue-600" />
        </div>
        <div className="h-full w-1/2 bg-red-500/10 flex items-center justify-end pr-6">
          <Trash2 className="text-red-600" />
        </div>
      </div>

      {/* Foreground Content Layer */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2} // resistance
        onDragEnd={handleDragEnd}
        animate={controls}
        whileTap={{ scale: 0.98 }}
        className="relative bg-card rounded-xl border shadow-sm touch-pan-y"
        style={{ x: 0 }}
      >
        <Link to={`/songs/${song.id}`} className="flex items-center p-3 gap-4">
          {/* Album Art Thumbnail */}
          <div className="shrink-0 rounded-md overflow-hidden bg-secondary w-14 h-14 shadow-inner relative">
            {song.cover_url ? (
              <img 
                src={song.cover_url} 
                alt={song.title} 
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full text-muted-foreground/30">
                <Music className="w-6 h-6" />
              </div>
            )}
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base leading-none mb-1.5 truncate pr-2">
              {song.title}
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              {song.artist}
            </p>
          </div>

          {/* Metadata Badges */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            {song.key && (
              <span className="px-2 py-0.5 rounded-full bg-secondary/50 text-[10px] font-medium text-secondary-foreground border border-border/50">
                {song.key}
              </span>
            )}
            {song.tempo && (
              <span className="text-[10px] text-muted-foreground font-mono">
                {song.tempo} bpm
              </span>
            )}
          </div>
        </Link>
      </motion.div>
    </div>
  );
};

const SongList = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  const { data: songs = [], isLoading } = useQuery({
    queryKey: ['songs'],
    queryFn: getSongs
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSong,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs'] });
      toast.success("Song deleted");
    },
    onError: () => {
      toast.error("Failed to delete song");
    }
  });

  const filteredSongs = songs.filter(
    (song) =>
      song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6 pb-20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sticky top-[56px] md:top-0 z-30 bg-background/95 backdrop-blur py-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Songs</h1>
            <p className="text-muted-foreground text-sm">
              Swipe left to delete, right to edit.
            </p>
          </div>
          <Button asChild className="rounded-full shadow-lg hover:shadow-xl transition-all">
            <Link to="/songs/new">
              <Plus className="mr-2 h-4 w-4" /> Add Song
            </Link>
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search repertoire..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-11 rounded-xl bg-muted/40 border-0 focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:bg-background transition-all"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-1">
            {filteredSongs.length === 0 ? (
              <div className="text-center py-20">
                 <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <Music className="w-8 h-8 text-muted-foreground" />
                 </div>
                 <h3 className="text-lg font-medium">No songs found</h3>
                 <p className="text-muted-foreground mt-1">
                   {searchTerm ? "Try adjusting your search terms." : "Start building your repertoire!"}
                 </p>
              </div>
            ) : (
              filteredSongs.map((song) => (
                <SongListItem 
                  key={song.id} 
                  song={song} 
                  onDelete={(id) => deleteMutation.mutate(id)} 
                />
              ))
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default SongList;