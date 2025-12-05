import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSong, deleteSong, saveSong } from "@/lib/api";
import { useNavigate, useParams, Link, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMetronome } from "@/components/MetronomeContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useRef } from "react";
import { searchMusic, fetchAudioFeatures, fetchLyrics } from "@/lib/musicApi";
import { motion } from "framer-motion";
import { 
  ChevronLeft, 
  Edit, 
  Trash2, 
  Music2, 
  Timer, 
  StickyNote,
  Loader2,
  ExternalLink,
  Music,
  Square,
  Play,
  Wand2,
  AlertTriangle,
  SkipForward
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Song } from "@/types";

interface BatchState {
  batchMode: boolean;
  queue: string[];
  total: number;
  current: number;
}

const SongDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { openMetronome, closeMetronome, isPlaying } = useMetronome();
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Batch State
  const batchState = location.state as BatchState | undefined;
  const hasTriggeredRef = useRef(false);

  // Search State
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Conflict Resolution State
  const [candidateData, setCandidateData] = useState<Partial<Song> | null>(null);
  const [isConflictOpen, setIsConflictOpen] = useState(false);
  const [conflictingFields, setConflictingFields] = useState<string[]>([]);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        setIsAdmin(data?.role === 'admin');
      }
    };
    checkAdmin();
  }, []);

  const { data: song, isLoading } = useQuery({
    queryKey: ['song', id],
    queryFn: () => getSong(id!),
    enabled: !!id
  });

  // Auto-trigger for batch mode
  useEffect(() => {
    if (batchState?.batchMode && song && !isFetchingDetails && !isSearchOpen && !candidateData && !hasTriggeredRef.current) {
        // Simple heuristic to prevent infinite loop or double trigger
        hasTriggeredRef.current = true;
        // Small delay to let UI render first
        const timer = setTimeout(() => {
            handleFetchDetails();
        }, 500);
        return () => clearTimeout(timer);
    }
  }, [song, batchState]);

  // Reset trigger ref when ID changes
  useEffect(() => {
    hasTriggeredRef.current = false;
  }, [id]);

  const handleNextBatch = () => {
    if (!batchState) return;
    
    if (batchState.queue.length === 0) {
        toast.success("Batch update complete!");
        navigate("/songs");
        return;
    }

    const [nextId, ...remaining] = batchState.queue;
    navigate(`/songs/${nextId}`, {
        state: {
            ...batchState,
            queue: remaining,
            current: batchState.current + 1
        },
        replace: true // Replace history to avoid back button hell
    });
  };

  const deleteMutation = useMutation({
    mutationFn: deleteSong,
    onSuccess: () => {
      toast.success("Song deleted");
      queryClient.invalidateQueries({ queryKey: ['songs'] });
      
      if (batchState?.batchMode) {
        handleNextBatch();
      } else {
        navigate("/songs");
      }
    },
    onError: () => {
      toast.error("Failed to delete song");
    }
  });

  const updateSongMutation = useMutation({
    mutationFn: saveSong,
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['song', id] });
        toast.success("Song updated successfully");
        setIsSearchOpen(false);
        setIsConflictOpen(false);
        setCandidateData(null);
        
        if (batchState?.batchMode) {
            handleNextBatch();
        }
    }
  });

  const handleDelete = () => {
    if (id) {
      deleteMutation.mutate(id);
    }
  };

  const toggleMetronome = () => {
    if (isPlaying) {
      closeMetronome();
    } else {
      if (song?.tempo) {
        const bpm = parseInt(song.tempo);
        if (!isNaN(bpm)) {
          openMetronome(bpm);
          toast.success(`Metronome started at ${bpm} BPM`);
        } else {
          toast.error("Invalid tempo format");
        }
      } else {
        openMetronome(120); // Default
        toast.info("No tempo set. Started at 120 BPM.");
      }
    }
  };

  const handleFetchDetails = async () => {
    if (!song) return;
    setIsFetchingDetails(true);
    try {
        const results = await searchMusic(`${song.artist} ${song.title}`);
        if (results.length === 0) {
            toast.error("No matches found on Spotify");
        } else {
            setSearchResults(results);
            setIsSearchOpen(true);
        }
    } catch (error) {
        toast.error("Search failed");
    } finally {
        setIsFetchingDetails(false);
    }
  };

  const confirmMatch = async (result: any) => {
      if (!song) return;
      setIsFetchingDetails(true);
      const toastId = toast.loading("Fetching metadata (Key, Tempo, Lyrics)...");
      
      try {
        // Parallel fetch for speed
        const [features, lyrics] = await Promise.all([
            fetchAudioFeatures(result.id),
            fetchLyrics(result.artist, result.title)
        ]);
        
        // Prepare potential new data
        const newData: Partial<Song> = {
            id: song.id,
            spotify_url: result.spotifyUrl || "", // Always update link if they selected a match
        };

        // Collect fields we found
        if (features.key) newData.key = features.key;
        if (features.tempo) newData.tempo = features.tempo;
        if (result.duration) newData.duration = result.duration;
        if (result.coverUrl) newData.cover_url = result.coverUrl;
        if (lyrics) newData.lyrics = lyrics;

        // Check for conflicts
        const conflicts: string[] = [];
        if (newData.key && song.key && newData.key !== song.key) conflicts.push("Key");
        if (newData.tempo && song.tempo && newData.tempo !== song.tempo) conflicts.push("Tempo");
        if (newData.duration && song.duration && newData.duration !== song.duration) conflicts.push("Duration");
        if (newData.cover_url && song.cover_url && newData.cover_url !== song.cover_url) conflicts.push("Album Art");
        if (newData.lyrics && song.lyrics && newData.lyrics !== song.lyrics) conflicts.push("Lyrics");

        setCandidateData(newData);
        setConflictingFields(conflicts);

        toast.dismiss(toastId);

        if (conflicts.length > 0) {
            // If we have conflicts, ask the user
            setIsConflictOpen(true);
        } else {
            // No conflicts (either fields matched or were empty), safe to merge
            // Use "Fill Missing" logic effectively, which here is just merging since no conflicts exist
            handleApplyUpdate(newData, 'overwrite'); 
        }

      } catch (error) {
          console.error(error);
          toast.error("Failed to fetch details", { id: toastId });
      } finally {
          setIsFetchingDetails(false);
      }
  };

  const handleApplyUpdate = (data: Partial<Song>, strategy: 'missing' | 'overwrite') => {
      if (!song) return;

      const finalUpdate: any = { id: song.id, spotify_url: data.spotify_url };

      const fields = ['key', 'tempo', 'duration', 'cover_url', 'lyrics', 'note'] as const;

      fields.forEach(field => {
          const existingVal = song[field];
          const newVal = data[field as keyof typeof data];

          if (strategy === 'overwrite') {
              // Use new value if present, else keep existing
              finalUpdate[field] = newVal || existingVal;
          } else {
              // 'missing': Only use new value if existing is empty
              finalUpdate[field] = existingVal || newVal;
          }
      });

      updateSongMutation.mutate(finalUpdate);
  };

  if (isLoading) return (
    <AppLayout>
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </AppLayout>
  );

  if (!song) return (
    <AppLayout>
      <div className="text-center p-8">Song not found</div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <motion.div 
        className="space-y-6 pb-20"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Batch Mode Progress Banner */}
        {batchState && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center justify-between mb-4 sticky top-[56px] z-20 backdrop-blur">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <Wand2 className="h-4 w-4 text-primary" />
                    <span>Auto-Filling: Song {batchState.current} of {batchState.total}</span>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="h-7" onClick={() => navigate('/songs')}>
                        Exit
                    </Button>
                    <Button size="sm" variant="secondary" className="h-7" onClick={handleNextBatch}>
                        Skip <SkipForward className="ml-1 h-3 w-3" />
                    </Button>
                </div>
            </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/songs")}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight truncate max-w-[200px] sm:max-w-md">
              {song.title}
            </h1>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
                <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={handleFetchDetails} 
                    disabled={isFetchingDetails}
                    title="Auto-fetch Key & Tempo"
                >
                    {isFetchingDetails ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                </Button>
            )}
            
            <Button asChild variant="outline" size="icon">
              <Link to={`/songs/${id}/edit`}>
                <Edit className="h-4 w-4" />
              </Link>
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete song?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete "{song.title}".
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Hero Section with Art */}
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <motion.div 
            className="shrink-0 mx-auto sm:mx-0"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
             {song.cover_url ? (
               <img 
                 src={song.cover_url} 
                 alt={song.title} 
                 className="w-48 h-48 rounded-lg shadow-md object-cover"
               />
             ) : (
               <div className="w-48 h-48 rounded-lg shadow-md bg-secondary flex items-center justify-center">
                 <Music className="w-16 h-16 text-muted-foreground opacity-50" />
               </div>
             )}
          </motion.div>

          <div className="flex-1 w-full space-y-4">
             <div className="text-center sm:text-left">
               <h2 className="text-2xl font-semibold">{song.title}</h2>
               <p className="text-lg text-muted-foreground">{song.artist}</p>
             </div>
             
             {/* Action Buttons - Grid on mobile, Flex on desktop */}
             <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-3">
               {song.spotify_url && (
                 <Button asChild variant="outline" className="w-full sm:w-auto gap-2 text-[#1DB954] hover:text-[#1DB954] border-[#1DB954]/20 hover:bg-[#1DB954]/10">
                   <a href={song.spotify_url} target="_blank" rel="noopener noreferrer">
                     <Music className="w-4 h-4" />
                     Open in Spotify
                     <ExternalLink className="w-3 h-3 ml-1" />
                   </a>
                 </Button>
               )}
               
               <Button 
                onClick={toggleMetronome} 
                variant={isPlaying ? "destructive" : "outline"} 
                className="w-full sm:w-auto gap-2"
               >
                  {isPlaying ? (
                    <>
                      <Square className="w-4 h-4 fill-current" />
                      Stop Metronome
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      Start Metronome
                    </>
                  )}
               </Button>
             </div>

             <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                <Card className="p-3 flex flex-col items-center text-center bg-secondary/10">
                  <div className="flex items-center gap-1 mb-1">
                    <Music2 className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground uppercase">Key</span>
                  </div>
                  <span className="font-semibold">{song.key || "-"}</span>
                </Card>
                
                <Card className="p-3 flex flex-col items-center text-center bg-secondary/10">
                   <div className="flex items-center gap-1 mb-1">
                    <Timer className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground uppercase">Tempo</span>
                  </div>
                  <span className="font-semibold">{song.tempo ? `${song.tempo} BPM` : "-"}</span>
                </Card>

                <Card className="p-3 flex flex-col items-center text-center bg-secondary/10 col-span-2 sm:col-span-1">
                  <div className="flex items-center gap-1 mb-1">
                    <StickyNote className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground uppercase">Note</span>
                  </div>
                  <span className="font-semibold truncate w-full" title={song.note || ""}>{song.note || "-"}</span>
                </Card>
             </div>
          </div>
        </div>

        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.2, duration: 0.4 }}
        >
          <Card className="min-h-[400px] p-8 bg-card relative">
            {song.lyrics ? (
              <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                {song.lyrics}
              </div>
            ) : (
              <div className="text-muted-foreground italic">No lyrics/chords added.</div>
            )}
          </Card>
        </motion.div>

        {/* Admin Search Dialog */}
        <Dialog open={isSearchOpen} onOpenChange={(open) => {
            setIsSearchOpen(open);
            // If closed without action in batch mode, we do nothing. 
            // The user must click Skip or Exit in banner.
        }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Select Match</DialogTitle>
                    <DialogDescription>
                        Choose the correct Spotify track to auto-fill metadata.
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[300px] overflow-y-auto space-y-2">
                    {searchResults.map(result => (
                        <div 
                            key={result.id} 
                            className="flex items-center gap-3 p-2 hover:bg-accent rounded cursor-pointer"
                            onClick={() => confirmMatch(result)}
                        >
                             <img src={result.coverUrl} className="w-10 h-10 rounded" />
                             <div className="overflow-hidden">
                                 <p className="font-medium truncate">{result.title}</p>
                                 <p className="text-xs text-muted-foreground truncate">{result.artist}</p>
                             </div>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>

        {/* Conflict Resolution Dialog */}
        <Dialog open={isConflictOpen} onOpenChange={setIsConflictOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                        Data Conflict
                    </DialogTitle>
                    <DialogDescription>
                        The data found differs from what is currently saved for: 
                        <span className="block mt-2 font-medium text-foreground">
                            {conflictingFields.join(", ")}
                        </span>
                    </DialogDescription>
                </DialogHeader>
                <div className="py-2 text-sm text-muted-foreground">
                    How would you like to proceed?
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={() => setIsConflictOpen(false)}>
                        Cancel
                    </Button>
                    <Button 
                        variant="secondary" 
                        onClick={() => candidateData && handleApplyUpdate(candidateData, 'missing')}
                    >
                        Fill Missing Only
                    </Button>
                    <Button 
                        onClick={() => candidateData && handleApplyUpdate(candidateData, 'overwrite')}
                    >
                        Overwrite All
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

      </motion.div>
    </AppLayout>
  );
};

export default SongDetail;