import AppLayout from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuTrigger, 
  DropdownMenuCheckboxItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from "@/components/ui/dropdown-menu";
import { getSongs, deleteSong, getSongUsage, saveSong } from "@/lib/api";
import { Plus, Search, Loader2, Trash2, Edit, Music, Filter, SortAsc, AlertTriangle, Archive } from "lucide-react";
import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, PanInfo, useAnimation } from "framer-motion";
import { toast } from "sonner";
import { Song } from "@/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

// Swipeable Item Component
const SongListItem = ({ song, onDeleteRequest }: { song: Song; onDeleteRequest: (song: Song) => void }) => {
  const navigate = useNavigate();
  const controls = useAnimation();
  
  const handleDragEnd = async (event: any, info: PanInfo) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    // Swipe Left to Delete (threshold -100)
    if (offset < -100 || velocity < -500) {
      onDeleteRequest(song);
      controls.start({ x: 0 }); // Reset position
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
        className={`relative bg-card rounded-xl border shadow-sm touch-pan-y ${song.is_retired ? 'border-2 border-dashed border-destructive/40 bg-muted/20' : ''}`}
        style={{ x: 0 }}
      >
        <Link to={`/songs/${song.id}`} className="flex items-center p-3 gap-4">
          {/* Album Art Thumbnail */}
          <div className="shrink-0 rounded-md overflow-hidden bg-secondary w-14 h-14 shadow-inner relative grayscale-[0.2]">
            {song.cover_url ? (
              <img 
                src={song.cover_url} 
                alt={song.title} 
                className={`w-full h-full object-cover ${song.is_retired ? 'grayscale' : ''}`}
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
            <div className="flex items-center gap-2 mb-1.5">
              <h3 className={`font-semibold text-base leading-none truncate ${song.is_retired ? 'line-through text-muted-foreground' : ''}`}>
                {song.title}
              </h3>
              {song.is_retired && (
                <Badge variant="outline" className="text-[10px] h-4 px-1 py-0 border-destructive/40 text-destructive">Retired</Badge>
              )}
            </div>
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
  const [sortBy, setSortBy] = useState("title"); // title, artist, bpm_asc, bpm_desc
  const [showRetired, setShowRetired] = useState(false);
  
  // Safe Delete States
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);
  const [usageData, setUsageData] = useState<{setlistName: string, date: string}[]>([]);
  const [isCheckingUsage, setIsCheckingUsage] = useState(false);

  const queryClient = useQueryClient();

  const { data: songs = [], isLoading } = useQuery({
    queryKey: ['songs'],
    queryFn: getSongs
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSong,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs'] });
      setSongToDelete(null);
      setUsageData([]);
      toast.success("Song deleted permanently");
    },
    onError: () => {
      toast.error("Failed to delete song");
    }
  });

  const retireMutation = useMutation({
    mutationFn: async (songId: string) => {
        const songToRetire = songs.find(s => s.id === songId);
        if(!songToRetire) return;
        return saveSong({ ...songToRetire, is_retired: true });
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['songs'] });
        setSongToDelete(null);
        setUsageData([]);
        toast.success("Song retired successfully");
    }
  });

  // --- Search & Filter Logic ---
  
  const cleanString = (str: string) => {
      return str.toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  const filteredAndSortedSongs = useMemo(() => {
    let result = songs;

    // 1. Search (Strict Cleaner)
    if (searchTerm.trim()) {
      const cleanTerm = cleanString(searchTerm);
      result = result.filter(s => {
          return cleanString(s.title).includes(cleanTerm) || 
                 cleanString(s.artist).includes(cleanTerm);
      });
    }

    // 2. Filter Retired - STRICT CHECK
    if (!showRetired) {
      result = result.filter(s => s.is_retired !== true);
    }

    // 3. Sort
    return [...result].sort((a, b) => {
      switch (sortBy) {
        case "artist":
          return a.artist.localeCompare(b.artist);
        case "bpm_asc":
          return (Number(a.tempo) || 0) - (Number(b.tempo) || 0);
        case "bpm_desc":
          return (Number(b.tempo) || 0) - (Number(a.tempo) || 0);
        case "key":
            return (a.key || "").localeCompare(b.key || "");
        case "title":
        default:
          return a.title.localeCompare(b.title);
      }
    });
  }, [songs, searchTerm, sortBy, showRetired]);


  // --- Handlers ---

  const handleDeleteRequest = async (song: Song) => {
    setSongToDelete(song);
    setIsCheckingUsage(true);
    setUsageData([]);
    
    try {
        const usage = await getSongUsage(song.id);
        setUsageData(usage);
    } catch (error) {
        console.error("Failed to check song usage", error);
    } finally {
        setIsCheckingUsage(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 pb-20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sticky top-[56px] md:top-0 z-30 bg-background/95 backdrop-blur py-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Songs</h1>
            <p className="text-muted-foreground text-sm">
              Manage your repertoire.
            </p>
          </div>
          <Button asChild className="rounded-full shadow-lg hover:shadow-xl transition-all h-12 px-6 text-base">
            <Link to="/songs/new">
              <Plus className="mr-2 h-5 w-5" /> Add Song
            </Link>
          </Button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex items-center gap-2">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search (e.g. dont stop...)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-11 rounded-xl bg-muted/40 border-0 focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:bg-background transition-all"
                />
            </div>
            
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-xl">
                        <Filter className="h-5 w-5" />
                        {showRetired && (
                            <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-2">
                    <DropdownMenuLabel className="px-2 py-2 text-base">Filters</DropdownMenuLabel>
                    <DropdownMenuCheckboxItem 
                        checked={showRetired} 
                        onCheckedChange={setShowRetired}
                        className="py-3 text-base"
                    >
                        Show Retired Songs
                    </DropdownMenuCheckboxItem>
                    
                    <DropdownMenuSeparator className="my-2" />
                    <DropdownMenuLabel className="px-2 py-2 text-base">Sort By</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={sortBy} onValueChange={setSortBy}>
                        <DropdownMenuRadioItem value="title" className="py-3 text-base">Title (A-Z)</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="artist" className="py-3 text-base">Artist (A-Z)</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="key" className="py-3 text-base">Key</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="bpm_asc" className="py-3 text-base">BPM (Low-High)</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="bpm_desc" className="py-3 text-base">BPM (High-Low)</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-1">
            {filteredAndSortedSongs.length === 0 ? (
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
              filteredAndSortedSongs.map((song) => (
                <SongListItem 
                  key={song.id} 
                  song={song} 
                  onDeleteRequest={handleDeleteRequest} 
                />
              ))
            )}
          </div>
        )}

        {/* Safe Delete Dialog */}
        <AlertDialog open={!!songToDelete} onOpenChange={(open) => !open && setSongToDelete(null)}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        Delete "{songToDelete?.title}"?
                    </AlertDialogTitle>
                    <div className="text-sm text-muted-foreground space-y-4 pt-2">
                        {isCheckingUsage ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" /> Checking usage...
                            </div>
                        ) : usageData.length > 0 ? (
                            <>
                                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md text-amber-600 dark:text-amber-400">
                                    <p className="font-semibold mb-1">Warning: Active in {usageData.length} Setlist{usageData.length !== 1 ? 's' : ''}</p>
                                    <p>Deleting this song will remove it from these setlists:</p>
                                </div>
                                <ScrollArea className="h-24 rounded border p-2">
                                    <ul className="list-disc list-inside space-y-1">
                                        {usageData.map((usage, idx) => (
                                            <li key={idx}>
                                                <span className="font-medium">{usage.setlistName}</span> 
                                                <span className="text-xs text-muted-foreground ml-2">({usage.date})</span>
                                            </li>
                                        ))}
                                    </ul>
                                </ScrollArea>
                                <p>
                                    Consider <b>Retiring</b> the song instead. Retired songs remain in existing setlists but cannot be added to new ones.
                                </p>
                            </>
                        ) : (
                            <p>
                                This will permanently delete this song from your repertoire. This action cannot be undone.
                            </p>
                        )}
                    </div>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    
                    {!isCheckingUsage && usageData.length > 0 && (
                        <Button 
                            variant="secondary" 
                            onClick={() => songToDelete && retireMutation.mutate(songToDelete.id)}
                            className="w-full sm:w-auto"
                        >
                            <Archive className="mr-2 h-4 w-4" /> Retire Instead
                        </Button>
                    )}
                    
                    <Button 
                        variant="destructive"
                        onClick={() => songToDelete && deleteMutation.mutate(songToDelete.id)}
                        className="w-full sm:w-auto"
                        disabled={isCheckingUsage}
                    >
                        {usageData.length > 0 ? "Delete Anyway" : "Delete Permanently"}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default SongList;