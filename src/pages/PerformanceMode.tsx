import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addSkippedSong, removeSkippedSong, saveSong } from "@/lib/api";
import { Song } from "@/types";
import { Button } from "@/components/ui/button";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle 
} from "@/components/ui/dialog";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  ChevronLeft, ChevronRight, Search, Loader2, Music, Minimize2, Menu, Timer, Edit, Forward, Check, CloudOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMetronome } from "@/components/MetronomeContext";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MetronomeControls } from "@/components/MetronomeControls";
import { useSetlistWithSongs, useSyncedSongs, useSyncedSkippedSongs } from "@/hooks/useSyncedData";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

const PerformanceMode = () => {
  const { id } = useParams(); // Setlist ID
  const [searchParams] = useSearchParams();
  const gigId = searchParams.get('gigId');
  const isGigMode = !!gigId;
  const isOnline = useNetworkStatus();

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openMetronome, isOpen: isMetronomeOpen, bpm, closeMetronome } = useMetronome();
  
  // Navigation State
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  
  // Ad-hoc / Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [tempSong, setTempSong] = useState<Song | null>(null);

  // Skipped Songs State
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  // Tempo Save Prompt
  const [showTempoSave, setShowTempoSave] = useState(false);
  const initialTempoRef = useRef<number | null>(null);

  // Use Hydrated Data (Offline Compatible)
  const setlist = useSetlistWithSongs(id);
  const { data: allSongs = [] } = useSyncedSongs();
  
  // Fetch from Master Cache
  const { data: allSkipped = [] } = useSyncedSkippedSongs();

  // Filter cached data for current gig
  const skippedSongs = useMemo(() => {
      if (!gigId) return [];
      return allSkipped
        .filter((entry: any) => entry.gig_id === gigId)
        .map((entry: any) => entry.song)
        .filter(Boolean) as Song[];
  }, [allSkipped, gigId]);

  // Derived Data
  const sets = useMemo(() => {
      if (!setlist) return [];
      const baseSets = [...setlist.sets];
      if (isGigMode && skippedSongs.length > 0) {
          // Add virtual set
          baseSets.push({
              id: 'skipped-set',
              name: 'Skipped Songs',
              position: 999,
              songs: skippedSongs.map((s, idx) => ({
                  id: `skip-${s.id}-${idx}`,
                  position: idx,
                  songId: s.id,
                  song: s
              }))
          });
      }
      return baseSets;
  }, [setlist, skippedSongs, isGigMode]);

  const currentSet = sets[currentSetIndex];
  const activeSong = tempSong || currentSet?.songs[currentSongIndex]?.song;

  // Track initial tempo to detect changes
  useEffect(() => {
      if (activeSong && activeSong.tempo) {
          initialTempoRef.current = parseInt(activeSong.tempo);
      } else {
          initialTempoRef.current = null;
      }
      // Close metronome on song change
      if (isMetronomeOpen) closeMetronome();
  }, [activeSong?.id]);

  // Mutations
  const skipSongMutation = useMutation({
      mutationFn: async () => {
          if (gigId && activeSong) {
              await addSkippedSong(gigId, activeSong.id);
          }
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['skipped_songs_all'] });
          toast.success("Song skipped & saved for later");
          handleNext();
          setShowSkipConfirm(false);
      }
  });

  const removeSkippedMutation = useMutation({
      mutationFn: async (songId: string) => {
          if (gigId) await removeSkippedSong(gigId, songId);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['skipped_songs_all'] });
        toast.success("Removed from skipped list");
      }
  });

  const updateTempoMutation = useMutation({
      mutationFn: async () => {
          if (!activeSong) return;
          await saveSong({ ...activeSong, tempo: bpm.toString() });
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['songs'] });
          queryClient.invalidateQueries({ queryKey: ['setlists'] }); // Refresh hydrated setlist
          toast.success("Tempo updated");
          setShowTempoSave(false);
      }
  });

  // Handlers
  const handleNext = () => {
    if (tempSong) {
      setTempSong(null);
      return;
    }
    if (!setlist || !currentSet) return;
    if (currentSongIndex < currentSet.songs.length - 1) {
      setCurrentSongIndex(prev => prev + 1);
    } else if (currentSetIndex < sets.length - 1) {
      setCurrentSetIndex(prev => prev + 1);
      setCurrentSongIndex(0);
    }
  };

  const handlePrev = () => {
    if (tempSong) {
      setTempSong(null);
      return;
    }
    if (!setlist) return;
    if (currentSongIndex > 0) {
      setCurrentSongIndex(prev => prev - 1);
    } else if (currentSetIndex > 0) {
      const prevSetIndex = currentSetIndex - 1;
      const prevSet = sets[prevSetIndex];
      setCurrentSetIndex(prevSetIndex);
      setCurrentSongIndex(prevSet.songs.length - 1);
    }
  };

  const handleSetChange = (value: string) => {
    const index = parseInt(value);
    if (!isNaN(index)) {
      setTempSong(null);
      setCurrentSetIndex(index);
      setCurrentSongIndex(0);
    }
  };

  const handleStartMetronome = () => {
      if(activeSong?.tempo) {
          openMetronome(parseInt(activeSong.tempo));
      } else {
          openMetronome(120);
      }
  };

  const handleMetronomeClose = () => {
      // Check if tempo changed and ask to save (Practice mode only, and online)
      if (!isGigMode && activeSong && initialTempoRef.current && bpm !== initialTempoRef.current && isOnline) {
          setShowTempoSave(true);
      }
      closeMetronome();
  };

  const handleEditSong = () => {
      if(activeSong) {
          navigate(`/songs/${activeSong.id}/edit`);
      }
  };

  const handleSkipRequest = () => {
      if(!isOnline) {
          toast.error("Offline: Cannot skip songs to queue.");
          return;
      }
      setShowSkipConfirm(true);
  };

  // Filter songs for search
  const filteredSongs = allSongs.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!setlist) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const isFirstSong = !tempSong && currentSetIndex === 0 && currentSongIndex === 0;
  const isLastSong = !tempSong && 
    currentSetIndex === sets.length - 1 && 
    currentSongIndex === (currentSet?.songs.length || 0) - 1;

  return (
    <div className="fixed inset-0 bg-background text-foreground flex flex-col z-50">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-card shadow-sm shrink-0 h-14 gap-2">
        <div className="flex-1 max-w-[200px] md:max-w-xs shrink-0 flex items-center gap-2">
          {!isOnline && <CloudOff className="h-4 w-4 text-muted-foreground" />}
          <Select 
            value={currentSetIndex.toString()} 
            onValueChange={handleSetChange}
            disabled={!!tempSong}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Select Set" />
            </SelectTrigger>
            <SelectContent>
              {sets.map((set, idx) => (
                <SelectItem key={set.id} value={idx.toString()}>
                  {set.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Title Display */}
        <div className="flex-1 text-center hidden md:flex items-center justify-center min-w-0 px-2">
            <span className="font-bold text-lg truncate">{activeSong?.title}</span>
            <span className="text-muted-foreground ml-2 text-sm truncate max-w-[150px]">{activeSong?.artist}</span>
        </div>

        <div className="flex items-center justify-end gap-2 flex-1 shrink-0">
             {/* Skip Action (Gig Mode) - Online Only */}
            {isGigMode && activeSong && !tempSong && currentSet?.id !== 'skipped-set' && isOnline && (
                 <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-orange-600 border-orange-200 hover:bg-orange-50 h-9"
                    onClick={handleSkipRequest}
                 >
                     <Forward className="w-4 h-4 mr-2" /> Skip
                 </Button>
            )}

            <Button variant="ghost" size="sm" onClick={() => navigate('/performance')} className="h-9">
                <span className="mr-2 hidden sm:inline">Exit</span>
                <Minimize2 className="h-4 w-4" />
            </Button>
        </div>
      </div>

      {/* Main Content (Lyrics) */}
      <div className="flex-1 overflow-hidden relative bg-background">
        <ScrollArea className="h-full w-full">
          <div className="p-4 md:p-8 max-w-4xl mx-auto min-h-full">
            {activeSong ? (
              <div className="space-y-6">
                <div className="md:hidden text-center border-b pb-4 mb-4">
                    <h2 className="text-2xl font-bold leading-tight">{activeSong.title}</h2>
                    <p className="text-muted-foreground">{activeSong.artist}</p>
                </div>

                <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-6">
                    {activeSong.key && (
                        <div className="bg-secondary px-3 py-1 rounded text-sm font-medium">
                            Key: {activeSong.key}
                        </div>
                    )}
                    {activeSong.tempo && (
                        <div className="bg-secondary px-3 py-1 rounded text-sm font-medium">
                            {activeSong.tempo} BPM
                        </div>
                    )}
                    {activeSong.note && (
                         <div className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 px-3 py-1 rounded text-sm font-medium">
                            {activeSong.note}
                         </div>
                    )}
                    
                    {/* Mark Done for Skipped Songs - Online Only */}
                    {isGigMode && currentSet?.id === 'skipped-set' && isOnline && (
                        <Button 
                            size="sm" 
                            variant="secondary" 
                            className="bg-green-100 text-green-800 hover:bg-green-200"
                            onClick={() => removeSkippedMutation.mutate(activeSong.id)}
                        >
                            <Check className="w-4 h-4 mr-2" /> Mark Played
                        </Button>
                    )}
                </div>

                <div className="whitespace-pre-wrap font-mono text-lg md:text-xl leading-relaxed pb-20">
                  {activeSong.lyrics || (
                    <span className="text-muted-foreground italic">No lyrics available for this song.</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
                <Music className="h-16 w-16 mb-4 opacity-20" />
                <p>Select a song to begin</p>
              </div>
            )}
          </div>
        </ScrollArea>
        
        {tempSong && (
            <div className="absolute top-4 right-4 bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg animate-pulse">
                Ad-Hoc
            </div>
        )}

        {/* Embedded Metronome (Practice Mode Only) */}
        {!isGigMode && isMetronomeOpen && (
            <div className="absolute bottom-0 left-0 right-0 z-10">
                <MetronomeControls variant="embedded" />
            </div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <div className="h-16 border-t bg-card shrink-0 flex items-center px-4 gap-3 z-20 relative">
        {/* Practice Mode Menu */}
        {!isGigMode ? (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-12 w-12 shrink-0">
                        <Menu className="h-5 w-5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48 mb-2">
                    <DropdownMenuItem onClick={handleStartMetronome} className="py-3">
                        <Timer className="mr-2 h-4 w-4" /> Metronome
                    </DropdownMenuItem>
                    {isOnline && (
                        <DropdownMenuItem onClick={handleEditSong} className="py-3">
                            <Edit className="mr-2 h-4 w-4" /> Edit Song
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setIsSearchOpen(true)} className="py-3">
                        <Search className="mr-2 h-4 w-4" /> Quick Find
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        ) : (
            // Gig Mode Ad-Hoc Search
            <Button variant="outline" size="icon" className="h-12 w-12 shrink-0" onClick={() => setIsSearchOpen(true)}>
                <Search className="h-5 w-5" />
            </Button>
        )}

        <Button 
          variant="outline" 
          className="flex-1 h-12 text-base"
          onClick={handlePrev}
          disabled={!tempSong && isFirstSong}
        >
          <ChevronLeft className="mr-2 h-5 w-5" /> Prev
        </Button>

        <Button 
          className={cn("flex-[1.5] h-12 text-base", tempSong ? "bg-orange-600 hover:bg-orange-700" : "")}
          onClick={handleNext}
          disabled={!tempSong && isLastSong}
        >
          {tempSong ? "Resume Set" : "Next Song"} <ChevronRight className="ml-2 h-5 w-5" />
        </Button>
      </div>

      {/* Search Dialog (Available in both modes now) */}
      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogContent className="max-w-md h-[80vh] flex flex-col p-0 gap-0">
            <DialogHeader className="px-4 py-4 border-b">
                <DialogTitle>Quick Find</DialogTitle>
            </DialogHeader>
            <div className="p-4 border-b bg-muted/20">
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search song to play next..." 
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                </div>
            </div>
            <ScrollArea className="flex-1">
                <div className="divide-y">
                    {filteredSongs.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">No songs found</div>
                    ) : (
                        filteredSongs.map(song => (
                            <div 
                                key={song.id} 
                                className="flex items-center p-4 hover:bg-accent cursor-pointer transition-colors"
                                onClick={() => {
                                    setTempSong(song);
                                    setIsSearchOpen(false);
                                    setSearchQuery("");
                                }}
                            >
                                <div className="flex-1">
                                    <div className="font-medium">{song.title}</div>
                                    <div className="text-sm text-muted-foreground">{song.artist}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Skip Confirmation Dialog */}
      <AlertDialog open={showSkipConfirm} onOpenChange={setShowSkipConfirm}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Skip this song?</AlertDialogTitle>
                  <AlertDialogDescription>
                      This will move "{activeSong?.title}" to the "Skipped Songs" list so you can easily return to it later in the show.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => skipSongMutation.mutate()}>Skip Song</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      {/* Tempo Save Dialog */}
      <AlertDialog open={showTempoSave} onOpenChange={setShowTempoSave}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Save new tempo?</AlertDialogTitle>
                  <AlertDialogDescription>
                      You changed the tempo to {bpm} BPM. Would you like to update the song record?
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>No</AlertDialogCancel>
                  <AlertDialogAction onClick={() => updateTempoMutation.mutate()}>Yes, Save</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PerformanceMode;