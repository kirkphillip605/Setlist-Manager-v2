import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getSetlist, getSongs } from "@/lib/api";
import { Song, Setlist } from "@/types";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  X, 
  Loader2, 
  Music, 
  Minimize2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

const PerformanceMode = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Navigation State
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  
  // Ad-hoc Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [tempSong, setTempSong] = useState<Song | null>(null);

  // Fetch Data
  const { data: setlist, isLoading } = useQuery({
    queryKey: ['setlist', id],
    queryFn: () => getSetlist(id!),
    enabled: !!id
  });

  const { data: allSongs = [] } = useQuery({
    queryKey: ['songs'],
    queryFn: getSongs,
    enabled: isSearchOpen // Only fetch when search is opened
  });

  // Derived Data
  const currentSet = setlist?.sets[currentSetIndex];
  // If we have a temp song (from search), show it. Otherwise show current setlist song.
  const activeSong = tempSong || currentSet?.songs[currentSongIndex]?.song;

  // Handlers
  const handleNext = () => {
    // If we are viewing a temp song, clear it and resume setlist at current position
    if (tempSong) {
      setTempSong(null);
      return;
    }

    if (!setlist || !currentSet) return;

    // Check if there are more songs in this set
    if (currentSongIndex < currentSet.songs.length - 1) {
      setCurrentSongIndex(prev => prev + 1);
    } 
    // Check if there are more sets
    else if (currentSetIndex < setlist.sets.length - 1) {
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
      const prevSet = setlist.sets[prevSetIndex];
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

  const handleAdHocSelect = (song: Song) => {
    setTempSong(song);
    setIsSearchOpen(false);
    setSearchQuery("");
  };

  // Filter songs for search
  const filteredSongs = allSongs.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading || !setlist) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const isFirstSong = !tempSong && currentSetIndex === 0 && currentSongIndex === 0;
  const isLastSong = !tempSong && 
    currentSetIndex === setlist.sets.length - 1 && 
    currentSongIndex === (currentSet?.songs.length || 0) - 1;

  return (
    <div className="fixed inset-0 bg-background text-foreground flex flex-col z-50">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-2 border-b bg-card shadow-sm shrink-0 h-14">
        <div className="flex-1 max-w-[200px] md:max-w-xs">
          <Select 
            value={currentSetIndex.toString()} 
            onValueChange={handleSetChange}
            disabled={!!tempSong}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select Set" />
            </SelectTrigger>
            <SelectContent>
              {setlist.sets.map((set, idx) => (
                <SelectItem key={set.id} value={idx.toString()}>
                  {set.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex-1 text-center hidden md:block">
            <span className="font-bold text-lg">{activeSong?.title}</span>
            <span className="text-muted-foreground ml-2 text-sm">{activeSong?.artist}</span>
        </div>

        <div className="flex-1 flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => navigate('/performance')}>
            <span className="mr-2 hidden sm:inline">Exit Mode</span>
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
        
        {/* Ad-hoc Indicator */}
        {tempSong && (
            <div className="absolute top-4 right-4 bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg animate-pulse">
                Ad-Hoc Request
            </div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <div className="h-16 border-t bg-card shrink-0 flex items-center justify-between px-4 gap-4">
        <Button 
          variant="outline" 
          className="flex-1 h-12 text-base"
          onClick={handlePrev}
          disabled={!tempSong && isFirstSong}
        >
          <ChevronLeft className="mr-2 h-5 w-5" /> Prev
        </Button>

        <Button 
          variant="secondary" 
          size="icon" 
          className="h-12 w-12 rounded-full shrink-0 shadow-sm border"
          onClick={() => setIsSearchOpen(true)}
        >
          <Search className="h-5 w-5" />
        </Button>

        <Button 
          className={cn("flex-1 h-12 text-base", tempSong ? "bg-orange-600 hover:bg-orange-700" : "")}
          onClick={handleNext}
          disabled={!tempSong && isLastSong}
        >
          {tempSong ? "Resume Set" : "Next Song"} <ChevronRight className="ml-2 h-5 w-5" />
        </Button>
      </div>

      {/* Search Dialog */}
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
                                onClick={() => handleAdHocSelect(song)}
                            >
                                <div className="flex-1">
                                    <div className="font-medium">{song.title}</div>
                                    <div className="text-sm text-muted-foreground">{song.artist}</div>
                                </div>
                                {song.key && (
                                    <span className="text-xs bg-secondary px-2 py-1 rounded text-muted-foreground">{song.key}</span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PerformanceMode;