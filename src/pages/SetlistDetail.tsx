import AppLayout from "@/components/AppLayout";
import { Loader2, CloudOff, Save, Undo, Plus, Star, Clock } from "lucide-react";
import { syncSetlist } from "@/lib/api";
import { parseDurationToSeconds, formatDurationRounded } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useImmer } from "use-immer";

import { SetlistHeader } from "@/components/SetlistHeader";
import { SetCard } from "@/components/SetCard";
import { AddSongDialog } from "@/components/AddSongDialog";
import { useSetlistWithSongs, useSyncedSongs } from "@/hooks/useSyncedData";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { Setlist, Set as SetType, SetSong } from "@/types";

const SetlistDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOnline = useNetworkStatus();
  
  // -- Data Fetching --
  const fetchedSetlist = useSetlistWithSongs(id);
  const { data: availableSongs = [] } = useSyncedSongs();

  // -- Local Editor State (Immer) --
  const [localSetlist, updateLocalSetlist] = useImmer<Setlist | null>(null);
  
  // Undo/History
  const [history, setHistory] = useState<Setlist[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [collapsedSets, setCollapsedSets] = useState<Record<string, boolean>>({});

  // -- UI State --
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [setToDelete, setSetToDelete] = useState<string | null>(null);
  const [songToRemove, setSongToRemove] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Initialize
  useEffect(() => {
      if (fetchedSetlist && !initialized) {
          // Initial Load
          updateLocalSetlist(fetchedSetlist); // Immer handles the object
          setInitialized(true);
      }
  }, [fetchedSetlist, initialized, updateLocalSetlist]);

  // Navigation Guard
  useEffect(() => {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
          if (isDirty) {
              e.preventDefault();
              e.returnValue = '';
          }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // -- Helpers --
  
  const pushHistory = useCallback(() => {
      if (localSetlist) {
          // We must take a snapshot. Immer state is a proxy, but we can clone it.
          // Since localSetlist here is the current state (Immer hook), we need to ensure we capture a plain object.
          // Actually, current(localSetlist) from 'immer' is needed if inside a producer, but here we are outside.
          // JSON parse/stringify is safe enough for this data structure.
          setHistory(prev => [...prev, JSON.parse(JSON.stringify(localSetlist))].slice(-20));
          setIsDirty(true);
      }
  }, [localSetlist]);

  const handleUndo = () => {
      if (history.length === 0) return;
      const previousState = history[history.length - 1];
      updateLocalSetlist(previousState);
      setHistory(prev => prev.slice(0, -1));
      if (history.length === 1) setIsDirty(false);
      toast.info("Undo successful");
  };

  // --- Actions ---

  const handleUpdateName = (newName: string) => {
      pushHistory();
      updateLocalSetlist(draft => { if (draft) draft.name = newName; });
  };

  const handleAddSet = (isEncore = false) => {
      if (!localSetlist) return;
      pushHistory();

      updateLocalSetlist(draft => {
          if (!draft) return;
          const newSetId = `temp-set-${Date.now()}`;
          const currentCount = draft.sets.filter(s => s.name !== "Encore").length;
          const position = draft.sets.length + 1;

          const encoreIndex = draft.sets.findIndex(s => s.name === "Encore");

          if (isEncore) {
              if (encoreIndex !== -1) {
                  toast.error("Encore set already exists.");
                  return;
              }
              draft.sets.push({
                  id: newSetId,
                  name: "Encore",
                  position,
                  songs: []
              });
          } else {
              const newSet: SetType = {
                  id: newSetId,
                  name: `Set ${currentCount + 1}`,
                  position: 0, // calc below
                  songs: []
              };

              if (encoreIndex !== -1) {
                  draft.sets.splice(encoreIndex, 0, newSet);
              } else {
                  draft.sets.push(newSet);
              }
          }

          // Re-normalize positions and names
          let setCounter = 1;
          draft.sets.forEach((s, i) => {
              s.position = i + 1;
              if (s.name !== "Encore") {
                  s.name = `Set ${setCounter++}`;
              }
          });
      });
  };

  const handleDeleteSet = (setId: string) => {
      pushHistory();
      updateLocalSetlist(draft => {
          if (!draft) return;
          draft.sets = draft.sets.filter(s => s.id !== setId);
          
          // Re-normalize
          let setCounter = 1;
          draft.sets.forEach((s, i) => {
              s.position = i + 1;
              if (s.name !== "Encore") {
                  s.name = `Set ${setCounter++}`;
              }
          });
      });
      setSetToDelete(null);
  };

  const handleAddSongs = async (targetSetId: string, songIds: string[]) => {
      pushHistory();
      updateLocalSetlist(draft => {
          if (!draft) return;
          const targetSet = draft.sets.find(s => s.id === targetSetId);
          if (!targetSet) return;

          const newSongs = songIds.map((sid, idx) => {
              const songData = availableSongs.find(s => s.id === sid);
              return {
                  id: `temp-song-${Date.now()}-${idx}`,
                  position: targetSet.songs.length + idx + 1,
                  songId: sid,
                  song: songData
              } as SetSong;
          });

          targetSet.songs.push(...newSongs);
      });
  };

  const handleCreateSetAndAdd = async (initialSongs: string[], remainingSongs: string[]) => {
      pushHistory();
      updateLocalSetlist(draft => {
          if (!draft) return;
          
          // 1. Add to active set
          if (activeSetId && initialSongs.length > 0) {
              const targetSet = draft.sets.find(s => s.id === activeSetId);
              if (targetSet) {
                  const newSongs = initialSongs.map((sid, idx) => ({
                      id: `temp-song-split-a-${idx}`,
                      position: targetSet.songs.length + idx + 1,
                      songId: sid,
                      song: availableSongs.find(s => s.id === sid)
                  } as SetSong));
                  targetSet.songs.push(...newSongs);
              }
          }

          // 2. Create new set
          const newSetId = `temp-set-split-${Date.now()}`;
          const encoreIndex = draft.sets.findIndex(s => s.name === "Encore");
          
          const newSet: SetType = {
              id: newSetId,
              name: "New Set", // Renamed below
              position: 0,
              songs: remainingSongs.map((sid, idx) => ({
                  id: `temp-song-split-b-${idx}`,
                  position: idx + 1,
                  songId: sid,
                  song: availableSongs.find(s => s.id === sid)
              } as SetSong))
          };

          if (encoreIndex !== -1) {
              draft.sets.splice(encoreIndex, 0, newSet);
          } else {
              draft.sets.push(newSet);
          }

          // Re-normalize
          let setCounter = 1;
          draft.sets.forEach((s, i) => {
              s.position = i + 1;
              if (s.name !== "Encore") {
                  s.name = `Set ${setCounter++}`;
              }
          });
      });
  };

  const handleRemoveSong = (songId: string) => {
      pushHistory();
      updateLocalSetlist(draft => {
          if (!draft) return;
          draft.sets.forEach(set => {
              const idx = set.songs.findIndex(s => s.id === songId);
              if (idx !== -1) {
                  set.songs.splice(idx, 1);
                  // Renumber
                  set.songs.forEach((s, i) => s.position = i + 1);
              }
          });
      });
      setSongToRemove(null);
  };

  const handleMoveOrder = (setId: string, songIndex: number, direction: 'up' | 'down') => {
      pushHistory();
      updateLocalSetlist(draft => {
          if (!draft) return;
          const set = draft.sets.find(s => s.id === setId);
          if (!set) return;

          const swapIndex = direction === 'up' ? songIndex - 1 : songIndex + 1;
          if (swapIndex < 0 || swapIndex >= set.songs.length) return;

          // Swap
          [set.songs[songIndex], set.songs[swapIndex]] = [set.songs[swapIndex], set.songs[songIndex]];
          
          // Fix positions
          set.songs.forEach((s, i) => s.position = i + 1);
      });
  };

  const handleMoveToSet = (setSongId: string, targetSetId: string) => {
      pushHistory();
      updateLocalSetlist(draft => {
          if (!draft) return;
          
          // Find and Remove
          let songToMove: SetSong | null = null;
          draft.sets.forEach(set => {
              const idx = set.songs.findIndex(s => s.id === setSongId);
              if (idx !== -1) {
                  songToMove = set.songs[idx];
                  set.songs.splice(idx, 1);
                  set.songs.forEach((s, i) => s.position = i + 1);
              }
          });

          // Insert
          if (songToMove) {
              const target = draft.sets.find(s => s.id === targetSetId);
              if (target) {
                  // If we insert at end, position is length + 1
                  target.songs.push({ ...songToMove, position: target.songs.length + 1 });
              }
          }
      });
  };

  // --- Save / Discard ---

  const saveMutation = useMutation({
      mutationFn: async () => {
          if (!localSetlist) return;
          // Send to API
          await syncSetlist(localSetlist);
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['setlist', id] });
          queryClient.invalidateQueries({ queryKey: ['setlists'] });
          setIsDirty(false);
          setHistory([]);
          toast.success("Changes saved successfully");
          // Re-init happens via useEffect when query data updates
      },
      onError: (e) => toast.error("Failed to save: " + e.message)
  });

  const handleDiscard = () => {
      if (fetchedSetlist) {
          updateLocalSetlist(fetchedSetlist);
          setIsDirty(false);
          setHistory([]);
          setShowDiscardConfirm(false);
          toast.info("Changes discarded");
      }
  };

  // --- Render ---

  if (!localSetlist) return (
    <AppLayout>
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </AppLayout>
  );

  const totalDuration = localSetlist.sets
    .filter(s => s.name !== "Encore")
    .reduce((total, set) => {
        return total + set.songs.reduce((st, s) => st + parseDurationToSeconds(s.song?.duration), 0);
    }, 0);

  return (
    <AppLayout>
      <div className="space-y-6 pb-20 relative">
        {!isOnline && (
             <div className="bg-muted px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm text-muted-foreground">
                 <CloudOff className="h-4 w-4" /> Offline Mode: Edits queued
             </div>
        )}

        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b shadow-sm -mx-4 px-4 sm:mx-0 sm:px-0 pt-4 pb-3 mb-6">
            <SetlistHeader 
                name={localSetlist.name}
                onUpdateName={handleUpdateName}
            >
                {/* Header Action Area: Combo Button + Save/Undo */}
                <div className="flex items-center gap-2">
                    {/* Add Buttons Group (Desktop Only) */}
                    <div className="hidden md:flex items-center rounded-md border bg-background shadow-sm">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleAddSet(false)} 
                            className="h-8 rounded-r-none border-r px-3"
                        >
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> Set
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleAddSet(true)} 
                            className="h-8 rounded-l-none px-3 text-amber-600 hover:text-amber-700 dark:text-amber-500"
                        >
                            <Star className="mr-1.5 h-3.5 w-3.5" /> Encore
                        </Button>
                    </div>

                    {isDirty && (
                        <>
                            <Button variant="ghost" size="icon" onClick={handleUndo} disabled={history.length === 0} title="Undo">
                                <Undo className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setShowDiscardConfirm(true)} title="Discard">
                                <CloudOff className="h-4 w-4" /> 
                            </Button>
                            <Button 
                                size="sm" 
                                onClick={() => saveMutation.mutate()} 
                                disabled={saveMutation.isPending}
                                className="bg-green-600 hover:bg-green-700 text-white min-w-[80px]"
                            >
                                <Save className="h-4 w-4 mr-2" /> Save
                            </Button>
                        </>
                    )}
                </div>
            </SetlistHeader>
            
            {/* Stats Row */}
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground px-1">
                <div className="flex items-center gap-1.5 bg-secondary/50 px-2 py-1 rounded">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatDurationRounded(totalDuration)}</span>
                </div>
                <div>•</div>
                <div>{localSetlist.sets.length} Sets</div>
            </div>
        </div>

        <div className="space-y-6">
          {localSetlist.sets.length === 0 ? (
             <div className="text-center py-20 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground mb-4">No sets added yet.</p>
                <Button onClick={() => handleAddSet(false)}>Create First Set</Button>
             </div>
          ) : (
            localSetlist.sets.map((set) => (
               <SetCard 
                   key={set.id}
                   set={set}
                   setlist={localSetlist}
                   setDuration={set.songs.reduce((acc, s) => acc + parseDurationToSeconds(s.song?.duration), 0)}
                   isCollapsed={!!collapsedSets[set.id]}
                   onToggleCollapse={() => setCollapsedSets(prev => ({ ...prev, [set.id]: !prev[set.id] }))}
                   onAddSong={(setId) => { setActiveSetId(setId); setIsAddSongOpen(true); }}
                   onDeleteSet={(setId) => setSetToDelete(setId)}
                   onRemoveSong={(songId) => setSongToRemove(songId)}
                   onMoveOrder={handleMoveOrder}
                   onMoveToSet={handleMoveToSet}
               />
            ))
          )}
        </div>

        {/* Mobile FAB */}
        <div className="md:hidden fixed bottom-24 right-4 z-40 flex flex-col gap-3 items-end">
            <Button 
                onClick={() => handleAddSet(true)} 
                className="rounded-full shadow-lg bg-amber-500 hover:bg-amber-600 text-white h-10 w-10 p-0"
                title="Add Encore"
            >
                <Star className="h-5 w-5" />
            </Button>
            <Button 
                onClick={() => handleAddSet(false)} 
                className="rounded-full shadow-xl h-14 w-14 p-0"
                title="Add Set"
            >
                <Plus className="h-6 w-6" />
            </Button>
        </div>

        {isAddSongOpen && (
            <AddSongDialog 
                open={isAddSongOpen}
                setlist={localSetlist}
                activeSetId={activeSetId}
                availableSongs={availableSongs}
                onClose={() => setIsAddSongOpen(false)}
                onAddSongs={async (target, ids) => handleAddSongs(target, ids)}
                onCreateSetAndAdd={async (a, b) => handleCreateSetAndAdd(a, b)}
            />
        )}

        {/* Dialogs */}
        <AlertDialog open={!!setToDelete} onOpenChange={(open) => !open && setSetToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Set?</AlertDialogTitle>
                    <AlertDialogDescription>Sets following this one will be renumbered automatically.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => setToDelete && handleDeleteSet(setToDelete)} className="bg-destructive hover:bg-destructive/90">Delete Set</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!songToRemove} onOpenChange={(open) => !open && setSongToRemove(null)}>
            <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Remove Song?</AlertDialogTitle></AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => songToRemove && handleRemoveSong(songToRemove)}>Remove</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
                    <AlertDialogDescription>You have unsaved changes.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Keep Editing</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDiscard} className="bg-destructive hover:bg-destructive/90">Discard Changes</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <Dialog open={saveMutation.isPending} onOpenChange={() => {}}>
            <DialogContent className="sm:max-w-[300px] flex flex-col items-center justify-center py-10 outline-none" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                <h3 className="text-lg font-semibold">Saving Changes...</h3>
            </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default SetlistDetail;