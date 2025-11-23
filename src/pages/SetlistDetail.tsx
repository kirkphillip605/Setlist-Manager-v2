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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { 
  getSetlist, 
  getSongs, 
  createSet, 
  deleteSet, 
  addSongsToSet, 
  removeSongFromSet, 
  updateSetSongOrder,
  moveSetSongToSet
} from "@/lib/api";
import { Song } from "@/types";
import { parseDurationToSeconds, formatSecondsToDuration } from "@/lib/utils";
import { useEffect, useState, useMemo } from "react";
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
  Loader2,
  MoreVertical,
  Check,
  Clock,
  ArrowRightLeft
} from "lucide-react";

const SetlistDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Dialog States
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [songSearch, setSongSearch] = useState("");
  
  // Confirmation States
  const [setToDelete, setSetToDelete] = useState<string | null>(null);
  const [songToRemove, setSongToRemove] = useState<string | null>(null);

  // Selection State for Add Songs
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);

  const { data: setlist, isLoading } = useQuery({
    queryKey: ['setlist', id],
    queryFn: () => getSetlist(id!),
    enabled: !!id
  });

  const { data: availableSongs = [] } = useQuery({
    queryKey: ['songs'],
    queryFn: getSongs
  });

  // --- Derived State ---
  
  // Helper to calculate total seconds for a set
  const calculateSetDuration = (songs: { song?: Song }[]) => {
    return songs.reduce((acc, s) => acc + parseDurationToSeconds(s.song?.duration), 0);
  };

  // Get all song IDs currently used in the ENTIRE setlist to prevent duplicates
  const usedSongIds = useMemo(() => {
    const ids = new Set<string>();
    setlist?.sets.forEach(set => {
      set.songs.forEach(s => ids.add(s.songId));
    });
    return ids;
  }, [setlist]);

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
      setSetToDelete(null);
      toast.success("Set deleted");
    }
  });

  const addSongsMutation = useMutation({
    mutationFn: async () => {
      if (!activeSetId || !setlist || selectedSongIds.length === 0) return;
      const targetSet = setlist.sets.find(s => s.id === activeSetId);
      if (!targetSet) return;
      
      const startPosition = targetSet.songs.length + 1;
      await addSongsToSet(activeSetId, selectedSongIds, startPosition);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlist', id] });
      setIsAddSongOpen(false);
      setSelectedSongIds([]);
      toast.success(`${selectedSongIds.length} song(s) added`);
    }
  });

  const removeSongMutation = useMutation({
    mutationFn: removeSongFromSet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlist', id] });
      setSongToRemove(null);
      toast.success("Song removed from set");
    }
  });

  const reorderMutation = useMutation({
    mutationFn: updateSetSongOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlist', id] });
    }
  });
  
  const moveSetSongMutation = useMutation({
    mutationFn: async ({ setSongId, targetSetId }: { setSongId: string, targetSetId: string }) => {
      const targetSet = setlist?.sets.find(s => s.id === targetSetId);
      const newPosition = (targetSet?.songs.length || 0) + 1;
      await moveSetSongToSet(setSongId, targetSetId, newPosition);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlist', id] });
      toast.success("Song moved to new set");
    }
  });

  // --- Handlers ---

  const moveSongOrder = (setId: string, songIndex: number, direction: 'up' | 'down') => {
    if (!setlist) return;
    const set = setlist.sets.find(s => s.id === setId);
    if (!set) return;

    const songs = [...set.songs];
    const swapIndex = direction === 'up' ? songIndex - 1 : songIndex + 1;
    
    const itemA = songs[songIndex];
    const itemB = songs[swapIndex];

    const updates = [
      { id: itemA.id, position: songIndex + 1 }, // Note: assuming DB position was array index + 1 before swap, but we just swap positions basically
      { id: itemB.id, position: swapIndex + 1 }
    ];
    
    // Actually we need to set itemA to swapIndex+1 and itemB to songIndex+1
    // The previous code had a logic bug potentially if position wasn't strictly index+1
    // Let's be explicit:
    
    const updatePayload = [
        { id: itemA.id, position: swapIndex + 1 },
        { id: itemB.id, position: songIndex + 1 }
    ];

    reorderMutation.mutate(updatePayload);
  };

  const openAddSongModal = (setId: string) => {
    setActiveSetId(setId);
    setSongSearch("");
    setSelectedSongIds([]);
    setIsAddSongOpen(true);
  };

  const toggleSongSelection = (songId: string) => {
    setSelectedSongIds(prev => {
      if (prev.includes(songId)) {
        return prev.filter(id => id !== songId);
      } else {
        return [...prev, songId];
      }
    });
  };

  // Filter available songs
  const filteredAvailableSongs = availableSongs.filter(song => 
    song.title.toLowerCase().includes(songSearch.toLowerCase()) || 
    song.artist.toLowerCase().includes(songSearch.toLowerCase())
  );

  // Calculate stats for the Add Song Modal
  const activeSet = setlist?.sets.find(s => s.id === activeSetId);
  const currentDuration = activeSet ? calculateSetDuration(activeSet.songs) : 0;
  const addedDuration = selectedSongIds.reduce((acc, id) => {
    const song = availableSongs.find(s => s.id === id);
    return acc + parseDurationToSeconds(song?.duration);
  }, 0);
  const totalProjectedDuration = currentDuration + addedDuration;


  if (isLoading || !setlist) return (
    <AppLayout>
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </AppLayout>
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
            setlist.sets.map((set) => {
                const setDuration = calculateSetDuration(set.songs);
                return (
                  <Card key={set.id} className="overflow-hidden border-2">
                    <CardHeader className="bg-muted/40 py-3 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className="bg-background text-base px-3 py-1">{set.name}</Badge>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>{formatSecondsToDuration(setDuration)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openAddSongModal(set.id)} className="h-8">
                          <Plus className="mr-1 h-3 w-3" /> Add Song
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive" 
                            onClick={() => setSetToDelete(set.id)}
                        >
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
                              <div className="flex items-center gap-3 text-muted-foreground mr-3 w-6 justify-center">
                                <span className="text-sm font-mono">{index + 1}</span>
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <div className="font-medium truncate">{setSong.song?.title}</div>
                                </div>
                                <div className="text-xs text-muted-foreground truncate">{setSong.song?.artist}</div>
                              </div>

                              <div className="flex items-center gap-4 text-sm mr-4 shrink-0">
                                {setSong.song?.key && (
                                  <Badge variant="secondary" className="font-mono font-normal text-xs px-1.5 h-5">
                                    {setSong.song.key}
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground w-12 text-right">
                                    {setSong.song?.duration || "3:00"}
                                </span>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <div className="flex flex-col mr-1">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6" 
                                    disabled={index === 0}
                                    onClick={() => moveSongOrder(set.id, index, 'up')}
                                  >
                                    <ArrowUp className="h-3 w-3" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6"
                                    disabled={index === set.songs.length - 1}
                                    onClick={() => moveSongOrder(set.id, index, 'down')}
                                  >
                                    <ArrowDown className="h-3 w-3" />
                                  </Button>
                                </div>
                                
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => setSongToRemove(setSong.id)} className="text-destructive focus:text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" /> Remove from Set
                                        </DropdownMenuItem>
                                        
                                        <DropdownMenuSeparator />
                                        <DropdownMenuLabel>Move to Set...</DropdownMenuLabel>
                                        {setlist.sets.map(targetSet => (
                                            <DropdownMenuItem 
                                                key={targetSet.id}
                                                disabled={targetSet.id === set.id}
                                                onClick={() => moveSetSongMutation.mutate({ setSongId: setSong.id, targetSetId: targetSet.id })}
                                            >
                                                <ArrowRightLeft className="mr-2 h-4 w-4" /> {targetSet.name}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
            })
          )}
        </div>
        
        {/* Add Song Dialog */}
        <Dialog open={isAddSongOpen} onOpenChange={setIsAddSongOpen}>
          <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 gap-0">
            <DialogHeader className="px-6 py-4 border-b">
              <DialogTitle>Add Songs to {activeSet?.name}</DialogTitle>
            </DialogHeader>
            
            <div className="p-4 border-b bg-muted/20">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search repertoire..."
                  className="pl-9"
                  value={songSearch}
                  onChange={(e) => setSongSearch(e.target.value)}
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="divide-y">
                {filteredAvailableSongs.length === 0 ? (
                   <div className="text-center py-12 text-muted-foreground">
                    No matching songs found.
                   </div>
                ) : (
                  filteredAvailableSongs.map((song) => {
                    const isUsed = usedSongIds.has(song.id);
                    const isSelected = selectedSongIds.includes(song.id);
                    const selectionIndex = selectedSongIds.indexOf(song.id) + 1;

                    return (
                      <div
                        key={song.id}
                        className={`flex items-center p-3 gap-3 transition-colors ${isUsed ? 'opacity-50 bg-muted/50' : 'hover:bg-accent/50'}`}
                      >
                         <div className="shrink-0">
                            {isUsed ? (
                                <div className="w-8 h-8 flex items-center justify-center">
                                    <Check className="w-4 h-4 text-muted-foreground" />
                                </div>
                            ) : (
                                <Button
                                    size="icon"
                                    variant={isSelected ? "default" : "outline"}
                                    className="w-8 h-8 rounded-full"
                                    onClick={() => toggleSongSelection(song.id)}
                                >
                                    {isSelected ? (
                                        <span className="text-xs font-bold">{selectionIndex}</span>
                                    ) : (
                                        <Plus className="w-4 h-4" />
                                    )}
                                </Button>
                            )}
                         </div>

                         <div className="flex-1 min-w-0">
                             <div className="font-medium truncate">{song.title}</div>
                             <div className="text-xs text-muted-foreground truncate">{song.artist}</div>
                         </div>
                         
                         <div className="text-xs text-muted-foreground tabular-nums">
                            {song.duration || "3:00"}
                         </div>

                        {isUsed && (
                          <Badge variant="secondary" className="text-[10px]">In Setlist</Badge>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
            
            <DialogFooter className="border-t p-4 bg-muted/10 flex-col sm:flex-row items-center gap-4 justify-between !space-x-0">
                <div className="flex items-center gap-4 w-full sm:w-auto text-sm text-muted-foreground">
                    <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                        <span>Selected: <span className="font-medium text-foreground">{selectedSongIds.length}</span></span>
                        <span>Est. Duration: <span className="font-medium text-foreground">{formatSecondsToDuration(totalProjectedDuration)}</span></span>
                    </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="outline" onClick={() => setIsAddSongOpen(false)} className="flex-1 sm:flex-none">Cancel</Button>
                    <Button 
                        onClick={() => addSongsMutation.mutate()} 
                        disabled={selectedSongIds.length === 0 || addSongsMutation.isPending}
                        className="flex-1 sm:flex-none"
                    >
                        {addSongsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Add {selectedSongIds.length > 0 ? `${selectedSongIds.length} ` : ''}Song{selectedSongIds.length !== 1 ? 's' : ''}
                    </Button>
                </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Delete Set Alert */}
        <AlertDialog open={!!setToDelete} onOpenChange={(open) => !open && setSetToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Set?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will remove this set and all its songs from the setlist. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => setToDelete && removeSetMutation.mutate(setToDelete)} className="bg-destructive hover:bg-destructive/90">
                        Delete Set
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {/* Remove Song Alert */}
        <AlertDialog open={!!songToRemove} onOpenChange={(open) => !open && setSongToRemove(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Remove Song?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to remove this song from the set?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => songToRemove && removeSongMutation.mutate(songToRemove)}>
                        Remove
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

      </div>
    </AppLayout>
  );
};

export default SetlistDetail;