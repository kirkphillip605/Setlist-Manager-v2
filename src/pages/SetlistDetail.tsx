import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  getSetlist, 
  getSongs, 
  createSet, 
  deleteSet, 
  addSongToSet, 
  removeSongFromSet, 
  updateSetSongOrder 
} from "@/lib/api";
import { Song, Setlist } from "@/types";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  ChevronLeft, 
  Trash2, 
  Search, 
  ArrowUp, 
  ArrowDown, 
  Music,
  Loader2
} from "lucide-react";

const SetlistDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // State for the "Add Song" dialog
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [songSearch, setSongSearch] = useState("");

  const { data: setlist, isLoading } = useQuery({
    queryKey: ['setlist', id],
    queryFn: () => getSetlist(id!),
    enabled: !!id
  });

  const { data: availableSongs = [] } = useQuery({
    queryKey: ['songs'],
    queryFn: getSongs
  });

  // --- Mutations ---

  const addSetMutation = useMutation({
    mutationFn: async () => {
      if (!setlist) return;
      const newPosition = setlist.sets.length + 1;
      await createSet(setlist.id, `Set ${newPosition}`, newPosition);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlist', id] });
      toast.success("Set added");
    }
  });

  const removeSetMutation = useMutation({
    mutationFn: deleteSet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlist', id] });
      toast.success("Set deleted");
    }
  });

  const addSongMutation = useMutation({
    mutationFn: async (song: Song) => {
      if (!activeSetId || !setlist) return;
      const targetSet = setlist.sets.find(s => s.id === activeSetId);
      if (!targetSet) return;
      
      const newPosition = targetSet.songs.length + 1;
      await addSongToSet(activeSetId, song.id, newPosition);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlist', id] });
      setIsAddSongOpen(false);
      toast.success("Song added to set");
    }
  });

  const removeSongMutation = useMutation({
    mutationFn: removeSongFromSet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlist', id] });
    }
  });

  const reorderMutation = useMutation({
    mutationFn: updateSetSongOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlist', id] });
    }
  });

  const moveSong = (setId: string, songIndex: number, direction: 'up' | 'down') => {
    if (!setlist) return;
    const set = setlist.sets.find(s => s.id === setId);
    if (!set) return;

    const songs = [...set.songs];
    const swapIndex = direction === 'up' ? songIndex - 1 : songIndex + 1;
    
    // Swap logic
    const temp = songs[songIndex];
    songs[songIndex] = songs[swapIndex];
    songs[swapIndex] = temp;

    // Prepare update payload
    // We swap the positions in the DB.
    // songIndex is the current array index.
    const itemA = songs[songIndex]; // Item that moved
    const itemB = songs[swapIndex]; // Item that was swapped

    // Their new positions are simply their new array indices + 1
    const updates = [
      { id: itemA.id, position: songIndex + 1 },
      { id: itemB.id, position: swapIndex + 1 }
    ];

    // Optimistic UI update could go here, but for now we rely on refetch
    reorderMutation.mutate(updates);
  };

  if (isLoading || !setlist) return (
    <AppLayout>
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </AppLayout>
  );

  const openAddSongModal = (setId: string) => {
    setActiveSetId(setId);
    setSongSearch("");
    setIsAddSongOpen(true);
  };

  // Get a set of all song IDs currently used in ANY set of this setlist
  const usedSongIds = new Set<string>();
  setlist.sets.forEach(set => {
    set.songs.forEach(s => usedSongIds.add(s.songId));
  });

  const filteredAvailableSongs = availableSongs.filter(song => 
    song.title.toLowerCase().includes(songSearch.toLowerCase()) || 
    song.artist.toLowerCase().includes(songSearch.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6 pb-20">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sticky top-0 z-10 bg-background/95 backdrop-blur py-4 border-b">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/setlists")}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{setlist.name}</h1>
              <p className="text-muted-foreground text-sm">{setlist.date} • {setlist.sets.length} Sets</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => addSetMutation.mutate()} variant="outline" disabled={addSetMutation.isPending}>
              <Plus className="mr-2 h-4 w-4" /> Add Set
            </Button>
          </div>
        </div>

        {/* Sets Area */}
        <div className="space-y-6">
          {setlist.sets.length === 0 ? (
             <div className="text-center py-20 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground mb-4">No sets added yet.</p>
                <Button onClick={() => addSetMutation.mutate()}>Create First Set</Button>
             </div>
          ) : (
            setlist.sets.map((set) => (
              <Card key={set.id} className="overflow-hidden border-2">
                <CardHeader className="bg-muted/40 py-3 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-background">{set.name}</Badge>
                    <span className="text-sm text-muted-foreground">{set.songs.length} songs</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openAddSongModal(set.id)} className="h-8">
                      <Plus className="mr-1 h-3 w-3" /> Add Song
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeSetMutation.mutate(set.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {set.songs.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      No songs in this set.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {set.songs.map((setSong, index) => (
                        <div key={setSong.id} className="flex items-center p-3 hover:bg-accent/30 group">
                          <div className="flex items-center gap-3 text-muted-foreground mr-3">
                            <span className="w-4 text-center text-sm font-mono">{index + 1}</span>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{setSong.song?.title}</div>
                            <div className="text-xs text-muted-foreground truncate">{setSong.song?.artist}</div>
                          </div>

                          <div className="flex items-center gap-4 text-sm mr-4">
                            {setSong.song?.key && (
                              <Badge variant="secondary" className="font-mono font-normal text-xs">
                                {setSong.song.key}
                              </Badge>
                            )}
                            {setSong.song?.tempo && (
                              <span className="text-xs text-muted-foreground hidden sm:inline-block">
                                {setSong.song.tempo} bpm
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="flex flex-col">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6" 
                                disabled={index === 0}
                                onClick={() => moveSong(set.id, index, 'up')}
                              >
                                <ArrowUp className="h-3 w-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6"
                                disabled={index === set.songs.length - 1}
                                onClick={() => moveSong(set.id, index, 'down')}
                              >
                                <ArrowDown className="h-3 w-3" />
                              </Button>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => removeSongMutation.mutate(setSong.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
        
        {/* Add Song Dialog */}
        <Dialog open={isAddSongOpen} onOpenChange={setIsAddSongOpen}>
          <DialogContent className="max-w-md h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Add Song to Set</DialogTitle>
            </DialogHeader>
            
            <div className="relative my-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search repertoire..."
                className="pl-9"
                value={songSearch}
                onChange={(e) => setSongSearch(e.target.value)}
              />
            </div>

            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-1">
                {filteredAvailableSongs.length === 0 ? (
                   <div className="text-center py-8 text-muted-foreground">
                    No matching songs found.
                   </div>
                ) : (
                  filteredAvailableSongs.map((song) => {
                    const isUsed = usedSongIds.has(song.id);
                    return (
                      <button
                        key={song.id}
                        disabled={isUsed}
                        onClick={() => addSongMutation.mutate(song)}
                        className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left group"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                           <div className="bg-primary/10 p-2 rounded-md">
                              <Music className="h-4 w-4 text-primary" />
                           </div>
                           <div className="min-w-0">
                             <div className="font-medium truncate">{song.title}</div>
                             <div className="text-xs text-muted-foreground truncate">{song.artist}</div>
                           </div>
                        </div>
                        {isUsed && (
                          <Badge variant="secondary" className="text-[10px]">Added</Badge>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default SetlistDetail;