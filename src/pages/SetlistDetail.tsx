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
  moveSetSongToSet,
  updateSetlist
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
  ArrowRightLeft,
  Calendar
} from "lucide-react";
import Fuse from "fuse.js";

const MAX_SET_DURATION = 90 * 60; // 90 minutes in seconds

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
  const [showDurationWarning, setShowDurationWarning] = useState(false);

  // Selection State for Add Songs
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);

  // Local state for editing date
  const [editDate, setEditDate] = useState("");

  const { data: setlist, isLoading } = useQuery({
    queryKey: ['setlist', id],
    queryFn: () => getSetlist(id!),
    enabled: !!id
  });

  const { data: availableSongs = [] } = useQuery({
    queryKey: ['songs'],
    queryFn: getSongs
  });

  useEffect(() => {
    if (setlist?.date) setEditDate(setlist.date);
  }, [setlist?.date]);

  // --- Derived State ---
  
  const calculateSetDuration = (songs: { song?: Song }[]) => {
    return songs.reduce((acc, s) => acc + parseDurationToSeconds(s.song?.duration), 0);
  };

  const usedSongIds = useMemo(() => {
    const ids = new Set<string>();
    setlist?.sets.forEach(set => {
      set.songs.forEach(s => ids.add(s.songId));
    });
    return ids;
  }, [setlist]);

  // Clean Search Logic
  const cleanString = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

  const filteredAvailableSongs = useMemo(() => {
    let result = availableSongs.filter(s => !s.is_retired);
    if (songSearch.trim()) {
        const cleanTerm = cleanString(songSearch);
        result = result.filter(s => 
            cleanString(s.title).includes(cleanTerm) || 
            cleanString(s.artist).includes(cleanTerm)
        );
    }
    return result;
  }, [availableSongs, songSearch]);

  // --- Mutations ---

  const updateSetlistMutation = useMutation({
    mutationFn: async (date: string) => {
        if(!id) return;
        return updateSetlist(id, { date });
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['setlist', id] });
        toast.success("Date updated");
    }
  });

  const addSetMutation = useMutation({
    mutationFn: async () => {
      if (!setlist) return;
      const newPosition = setlist.sets.length + 1;
      return await createSet(setlist.id, `Set ${newPosition}`, newPosition);
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
    mutationFn: async (targetSetId: string) => {
      if (!targetSetId || !setlist || selectedSongIds.length === 0) return;
      const targetSet = setlist.sets.find(s => s.id === targetSetId);
      // For new sets that might not be in cache yet, allow fallback or assume 0
      const startPosition = targetSet ? targetSet.songs.length + 1 : 1;
      
      await addSongsToSet(targetSetId, selectedSongIds, startPosition);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlist', id] });
      setIsAddSongOpen(false);
      setSelectedSongIds([]);
      toast.success(`${selectedSongIds.length} song(s) added`);
      setShowDurationWarning(false);
    }
  });

  const createSetAndAddSongsMutation = useMutation({
    mutationFn: async () => {
        if (!setlist) return;
        // 1. Create new set
        const newPosition = setlist.sets.length + 1;
        const newSet = await createSet(setlist.id, `Set ${newPosition}`, newPosition);
        
        // 2. Add songs to new set
        if (newSet?.id) {
            await addSongsToSet(newSet.id, selectedSongIds, 1);
        }
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['setlist', id] });
        setIsAddSongOpen(false);
        setSelectedSongIds([]);
        setShowDurationWarning(false);
        toast.success("Created new set and added songs");
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
    // Clear search on selection for rapid entry
    setSongSearch("");
    
    setSelectedSongIds(prev => {
      if (prev.includes(songId)) {
        return prev.filter(id => id !== songId);
      } else {
        return [...prev, songId];
      }
    });
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditDate(e.target.value);
      updateSetlistMutation.mutate(e.target.value);
  };

  const handleAddSongsClick = () => {
      if (!activeSetId) return;
      const activeSet = setlist?.sets.find(s => s.id === activeSetId);
      const currentDuration = activeSet ? calculateSetDuration(activeSet.songs) : 0;
      const addedDuration = selectedSongIds.reduce((acc, id) => {
        const song = availableSongs.find(s => s.id === id);
        return acc + parseDurationToSeconds(song?.duration);
      }, 0);
      
      const projected = currentDuration + addedDuration;
      
      if (projected > MAX_SET_DURATION) {
          setShowDurationWarning(true);
      } else {
          addSongsMutation.mutate(activeSetId);
      }
  };

  // Calculate stats for the Add Song Modal
  const activeSet = setlist?.sets.find(s => s.id === activeSetId);
  const currentDuration = activeSet ? calculateSetDuration(activeSet.songs) : 0;
  const addedDuration = selectedSongIds.reduce((acc, id) => {
    const song = availableSongs.find(s => s.id === id);
    return acc + parseDurationToSeconds(song?.duration);
  }, 0);
  const totalProjectedDuration = currentDuration + addedDuration;
  const isOverTime = totalProjectedDuration > MAX_SET_DURATION;

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
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <h1 className="text-2xl font-bold tracking-tight">{setlist.name}</h1>
              <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input 
                     type="date" 
                     className="h-8 w-[140px]" 
                     value={editDate}
                     onChange={handleDateChange}
                  />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => addSetMutation.mutate()} variant="outline" disabled={addSetMutation.isPending} className="h-10">
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
                        <Button variant="ghost" size="sm" onClick={() => openAddSongModal(set.id)} className="h-10 px-3">
                          <Plus className="mr-1 h-4 w-4" /> Add Song
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-10 w-10 text-muted-foreground hover:text-destructive" 
                            onClick={() => setSetToDelete(set.id)}
                        >
                          <Trash2 className="h-5 w-5" />
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
                                    <div className={`font-medium truncate ${setSong.song?.is_retired ? 'line-through text-muted-foreground' : ''}`}>
                                        {setSong.song?.title}
                                    </div>
                                    {setSong.song?.is_retired && (
                                        <Badge variant="outline" className="text-[10px] h-4 px-1 py-0">Retired</Badge>
                                    )}
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
                                    className="h-8 w-8" 
                                    disabled={index === 0}
                                    onClick={() => moveSongOrder(set.id, index, 'up')}
                                  >
                                    <ArrowUp className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8"
                                    disabled={index === set.songs.length - 1}
                                    onClick={() => moveSongOrder(set.id, index, 'down')}
                                  >
                                    <ArrowDown className="h-4 w-4" />
                                  </Button>
                                </div>
                                
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-10 w-10">
                                            <MoreVertical className="h-5 w-5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="p-2">
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => setSongToRemove(setSong.id)} className="text-destructive focus:text-destructive py-3">
                                            <Trash2 className="mr-2 h-4 w-4" /> Remove from Set
                                        </DropdownMenuItem>
                                        
                                        <DropdownMenuSeparator />
                                        <DropdownMenuLabel>Move to Set...</DropdownMenuLabel>
                                        {setlist.sets.map(targetSet => (
                                            <DropdownMenuItem 
                                                key={targetSet.id}
                                                disabled={targetSet.id === set.id}
                                                onClick={() => moveSetSongMutation.mutate({ setSongId: setSong.id, targetSetId: targetSet.id })}
                                                className="py-3"
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
                <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search repertoire..."
                  className="pl-10 h-11 text-base"
                  value={songSearch}
                  onChange={(e) => setSongSearch(e.target.value)}
                  autoFocus
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
                        className={`flex items-center p-3 gap-3 transition-colors cursor-pointer ${isUsed ? 'opacity-50 bg-muted/50' : 'hover:bg-accent/50'}`}
                        onClick={() => !isUsed && toggleSongSelection(song.id)}
                      >
                         <div className="shrink-0">
                            {isUsed ? (
                                <div className="w-8 h-8 flex items-center justify-center">
                                    <Check className="w-5 h-5 text-muted-foreground" />
                                </div>
                            ) : (
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-colors ${isSelected ? 'bg-primary text-primary-foreground border-primary' : 'border-input'}`}>
                                    {isSelected ? (
                                        <span className="text-sm font-bold">{selectionIndex}</span>
                                    ) : (
                                        <Plus className="w-5 h-5" />
                                    )}
                                </div>
                            )}
                         </div>

                         <div className="flex-1 min-w-0">
                             <div className="font-medium truncate text-base">{song.title}</div>
                             <div className="text-sm text-muted-foreground truncate">{song.artist}</div>
                         </div>
                         
                         <div className="text-sm text-muted-foreground tabular-nums">
                            {song.duration || "3:00"}
                         </div>
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
                        <span>Est. Duration: <span className={`font-medium ${isOverTime ? "text-destructive" : "text-foreground"}`}>{formatSecondsToDuration(totalProjectedDuration)}</span></span>
                    </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="outline" onClick={() => setIsAddSongOpen(false)} className="flex-1 sm:flex-none h-11">Cancel</Button>
                    <Button 
                        onClick={handleAddSongsClick} 
                        disabled={selectedSongIds.length === 0 || addSongsMutation.isPending}
                        className="flex-1 sm:flex-none h-11"
                        variant={isOverTime ? "destructive" : "default"}
                    >
                        {addSongsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Add {selectedSongIds.length > 0 ? `${selectedSongIds.length} ` : ''}Song{selectedSongIds.length !== 1 ? 's' : ''}
                    </Button>
                </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Duration Warning Alert */}
        <AlertDialog open={showDurationWarning} onOpenChange={setShowDurationWarning}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Set Duration Warning</AlertDialogTitle>
                    <AlertDialogDescription>
                        Adding these songs will make the set duration <b>{formatSecondsToDuration(totalProjectedDuration)}</b>, which exceeds the recommended 90 minutes limit.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                    <AlertDialogCancel onClick={() => setShowDurationWarning(false)}>Cancel</AlertDialogCancel>
                    <Button variant="outline" onClick={() => activeSetId && addSongsMutation.mutate(activeSetId)}>
                        Add Anyway
                    </Button>
                    <AlertDialogAction onClick={() => createSetAndAddSongsMutation.mutate()}>
                        Create New Set & Add
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        
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