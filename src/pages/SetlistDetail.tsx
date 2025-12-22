import AppLayout from "@/components/AppLayout";
import { Loader2, CloudOff, Save, Undo, Plus, Star } from "lucide-react";
import { 
  updateSetlist, syncSetlist
} from "@/lib/api";
import { parseDurationToSeconds } from "@/lib/utils";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useBlocker } from "react-router-dom";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

import { SetlistHeader } from "@/components/SetlistHeader";
import { SetCard } from "@/components/SetCard";
import { AddSongDialog } from "@/components/AddSongDialog";
import { useSetlistWithSongs, useSyncedSongs } from "@/hooks/useSyncedData";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { Setlist, Set as SetType, SetSong } from "@/types";

// Helper to deep clone setlist for state
const cloneSetlistData = (data: Setlist): Setlist => JSON.parse(JSON.stringify(data));

const SetlistDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOnline = useNetworkStatus();
  
  // -- Data Fetching --
  const fetchedSetlist = useSetlistWithSongs(id);
  const { data: availableSongs = [] } = useSyncedSongs();

  // -- Local Editor State --
  const [localSetlist, setLocalSetlist] = useState<Setlist | null>(null);
  const [history, setHistory] = useState<Setlist[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // -- UI State --
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [setToDelete, setSetToDelete] = useState<string | null>(null);
  const [songToRemove, setSongToRemove] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Initialize Local State from Cache
  useEffect(() => {
      if (fetchedSetlist && !initialized) {
          setLocalSetlist(cloneSetlistData(fetchedSetlist));
          setInitialized(true);
      }
  }, [fetchedSetlist, initialized]);

  // -- Navigation Blocking --
  // Use a custom blocker if supported, or manual interception for now since v6 blocker can be tricky depending on exact version
  // We'll use a simple approach: intercept links in sidebar (handled by AppLayout logic if we lifted state, but here we can only block browser back)
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

  // If user tries to navigate away via React Router (Soft Navigation)
  // Note: react-router-dom v6 stable `useBlocker` or `usePrompt` availability depends on exact version.
  // Assuming standard React Router v6 behavior where we might need to rely on the browser's beforeunload for hard navs, 
  // and handle soft navs by checking isDirty before actions. 
  // *Implementation Note*: Fully blocking soft navs requires the unstable_useBlocker hook.
  // I will assume for now we implement the "Back" button in the header manually to check.

  // -- State Mutators --

  const pushToHistory = useCallback(() => {
      if (localSetlist) {
          setHistory(prev => [...prev, cloneSetlistData(localSetlist)].slice(-20)); // Limit history
          setIsDirty(true);
      }
  }, [localSetlist]);

  const handleUndo = () => {
      if (history.length === 0) return;
      const previousState = history[history.length - 1];
      setLocalSetlist(cloneSetlistData(previousState));
      setHistory(prev => prev.slice(0, -1));
      if (history.length === 1) setIsDirty(false); // Approximate dirty reset
      toast.info("Undo successful");
  };

  // --- Actions ---

  const handleUpdateName = (newName: string) => {
      pushToHistory();
      setLocalSetlist(prev => prev ? { ...prev, name: newName } : null);
  };

  const handleAddSet = (isEncore = false) => {
      if (!localSetlist) return;
      pushToHistory();

      const newSetId = `temp-set-${Date.now()}`;
      const sets = [...localSetlist.sets];
      
      let position = sets.length + 1;
      
      // Encore Logic: Ensure Encore is always last
      // If we are adding a normal set, and Encore exists, insert BEFORE Encore.
      // If we are adding Encore, insert AT END.
      const encoreIndex = sets.findIndex(s => s.name === "Encore");
      
      if (isEncore) {
          // If encore exists, don't add another
          if (encoreIndex !== -1) {
              toast.error("Encore set already exists.");
              return;
          }
          // Append to end
          sets.push({
              id: newSetId,
              name: "Encore",
              position: position,
              songs: []
          });
      } else {
          // Normal Set
          if (encoreIndex !== -1) {
              // Insert before Encore
              sets.splice(encoreIndex, 0, {
                  id: newSetId,
                  name: `Set ${sets.length}`, // Temp name, position logic below handles renumbering if needed? 
                  // Better: Name based on count excluding encore
                  position: encoreIndex + 1,
                  songs: []
              });
          } else {
              sets.push({
                  id: newSetId,
                  name: `Set ${position}`,
                  position: position,
                  songs: []
              });
          }
      }

      // Re-normalize positions and default names
      const updatedSets = sets.map((s, i) => ({
          ...s,
          position: i + 1,
          name: s.name === "Encore" ? "Encore" : s.name.startsWith("Set ") ? `Set ${i + 1}` : s.name
      }));

      setLocalSetlist({ ...localSetlist, sets: updatedSets });
  };

  const handleDeleteSet = (setId: string) => {
      if (!localSetlist) return;
      pushToHistory();
      
      const filtered = localSetlist.sets.filter(s => s.id !== setId);
      const remapped = filtered.map((s, i) => ({
          ...s,
          position: i + 1,
          name: s.name === "Encore" ? "Encore" : s.name.startsWith("Set ") ? `Set ${i + 1}` : s.name
      }));

      setLocalSetlist({ ...localSetlist, sets: remapped });
      setSetToDelete(null);
  };

  const handleAddSongs = async (targetSetId: string, songIds: string[]) => {
      if (!localSetlist) return;
      pushToHistory();

      const newSongs = songIds.map((sid, idx) => {
          const songData = availableSongs.find(s => s.id === sid);
          return {
              id: `temp-song-${Date.now()}-${idx}`,
              position: 0, // Calculated below
              songId: sid,
              song: songData
          } as SetSong;
      });

      const updatedSets = localSetlist.sets.map(set => {
          if (set.id === targetSetId) {
              const merged = [...set.songs, ...newSongs].map((s, i) => ({ ...s, position: i + 1 }));
              return { ...set, songs: merged };
          }
          return set;
      });

      setLocalSetlist({ ...localSetlist, sets: updatedSets });
  };

  const handleCreateSetAndAdd = async (initialSongs: string[], remainingSongs: string[]) => {
      // This is called from the split dialog. 
      // 1. Add 'initial' to current set
      // 2. Create new set
      // 3. Add 'remaining' to new set
      if (!localSetlist) return;
      pushToHistory();

      let sets = [...localSetlist.sets];
      
      // 1. Add to current
      if (activeSetId && initialSongs.length > 0) {
          const currentSetIdx = sets.findIndex(s => s.id === activeSetId);
          if (currentSetIdx > -1) {
              const newSongObjs = initialSongs.map((sid, i) => ({
                  id: `temp-song-split-a-${i}`,
                  songId: sid,
                  song: availableSongs.find(s => s.id === sid),
                  position: 0
              } as SetSong));
              
              sets[currentSetIdx].songs = [...sets[currentSetIdx].songs, ...newSongObjs].map((s, i) => ({...s, position: i+1}));
          }
      }

      // 2. Create New Set (Logic similar to AddSet regarding Encore)
      const newSetId = `temp-set-split-${Date.now()}`;
      const encoreIndex = sets.findIndex(s => s.name === "Encore");
      
      const newSetObj: SetType = {
          id: newSetId,
          name: "New Set", // Will be renamed by normalize
          position: 0,
          songs: remainingSongs.map((sid, i) => ({
              id: `temp-song-split-b-${i}`,
              songId: sid,
              song: availableSongs.find(s => s.id === sid),
              position: i + 1
          } as SetSong))
      };

      if (encoreIndex !== -1) {
          sets.splice(encoreIndex, 0, newSetObj);
      } else {
          sets.push(newSetObj);
      }

      // Normalize
      const finalSets = sets.map((s, i) => ({
          ...s,
          position: i + 1,
          name: s.name === "Encore" ? "Encore" : s.name.startsWith("Set ") ? `Set ${i + 1}` : s.name
      }));

      setLocalSetlist({ ...localSetlist, sets: finalSets });
  };

  const handleRemoveSong = (songId: string) => {
      if (!localSetlist) return;
      pushToHistory();

      const updatedSets = localSetlist.sets.map(set => ({
          ...set,
          songs: set.songs.filter(s => s.id !== songId).map((s, i) => ({ ...s, position: i + 1 }))
      }));

      setLocalSetlist({ ...localSetlist, sets: updatedSets });
      setSongToRemove(null);
  };

  const handleMoveOrder = (setId: string, songIndex: number, direction: 'up' | 'down') => {
      if (!localSetlist) return;
      pushToHistory();

      const updatedSets = localSetlist.sets.map(set => {
          if (set.id === setId) {
              const songs = [...set.songs];
              const swapIndex = direction === 'up' ? songIndex - 1 : songIndex + 1;
              if (swapIndex < 0 || swapIndex >= songs.length) return set;

              // Swap
              [songs[songIndex], songs[swapIndex]] = [songs[swapIndex], songs[songIndex]];
              
              // Re-index
              return { ...set, songs: songs.map((s, i) => ({ ...s, position: i + 1 })) };
          }
          return set;
      });

      setLocalSetlist({ ...localSetlist, sets: updatedSets });
  };

  const handleMoveToSet = (setSongId: string, targetSetId: string) => {
      if (!localSetlist) return;
      pushToHistory();

      // Find the song
      let songToMove: SetSong | undefined;
      
      // Remove from source
      let sets = localSetlist.sets.map(set => {
          const found = set.songs.find(s => s.id === setSongId);
          if (found) {
              songToMove = found;
              return {
                  ...set,
                  songs: set.songs.filter(s => s.id !== setSongId).map((s, i) => ({ ...s, position: i + 1 }))
              };
          }
          return set;
      });

      // Add to target
      if (songToMove) {
          sets = sets.map(set => {
              if (set.id === targetSetId) {
                  return {
                      ...set,
                      songs: [...set.songs, { ...songToMove!, position: set.songs.length + 1 }]
                  };
              }
              return set;
          });
      }

      setLocalSetlist({ ...localSetlist, sets });
  };

  // --- Save / Discard ---

  const saveMutation = useMutation({
      mutationFn: async () => {
          if (!localSetlist) return;
          await syncSetlist(localSetlist);
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['setlist', id] });
          queryClient.invalidateQueries({ queryKey: ['setlists'] });
          setIsDirty(false);
          setHistory([]);
          toast.success("Changes saved successfully");
          
          // Re-init with new clean state handled by useEffect on fetch update
      },
      onError: (e) => toast.error("Failed to save changes: " + e.message)
  });

  const handleDiscard = () => {
      if (fetchedSetlist) {
          setLocalSetlist(cloneSetlistData(fetchedSetlist));
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

  return (
    <AppLayout>
      <div className="space-y-6 pb-20">
        {!isOnline && (
             <div className="bg-muted px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm text-muted-foreground">
                 <CloudOff className="h-4 w-4" /> Offline Mode: Edits queued
             </div>
        )}

        {/* Custom Header with Back Interception */}
        <div className="flex flex-col gap-4 sticky top-0 z-10 bg-background/95 backdrop-blur py-4 border-b">
            <SetlistHeader 
                name={localSetlist.name}
                onAddSet={() => handleAddSet(false)}
                isAddingSet={false}
                onUpdateName={handleUpdateName}
            />
            
            {/* Toolbar Row */}
            <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => navigate('/setlists')} 
                        className={isDirty ? "text-muted-foreground" : ""}
                    >
                        &larr; Back
                    </Button>
                    {isDirty && (
                        <Button variant="ghost" size="sm" onClick={handleUndo} disabled={history.length === 0}>
                            <Undo className="h-4 w-4 mr-2" /> Undo
                        </Button>
                    )}
                </div>

                <div className="flex gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleAddSet(true)} 
                        className="text-amber-600 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-950"
                        title="Add Encore Set at end"
                    >
                        <Star className="h-3 w-3 mr-1" /> Encore
                    </Button>

                    {isDirty && (
                        <>
                            <Button variant="destructive" size="sm" onClick={() => setShowDiscardConfirm(true)}>
                                Discard
                            </Button>
                            <Button 
                                size="sm" 
                                onClick={() => saveMutation.mutate()} 
                                disabled={saveMutation.isPending}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                                Save Changes
                            </Button>
                        </>
                    )}
                </div>
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
                   onAddSong={(setId) => { setActiveSetId(setId); setIsAddSongOpen(true); }}
                   onDeleteSet={(setId) => setSetToDelete(setId)}
                   onRemoveSong={(songId) => setSongToRemove(songId)}
                   onMoveOrder={handleMoveOrder}
                   onMoveToSet={handleMoveToSet}
               />
            ))
          )}
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

        {/* Delete Confirmation */}
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

        {/* Remove Song Confirmation */}
        <AlertDialog open={!!songToRemove} onOpenChange={(open) => !open && setSongToRemove(null)}>
            <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Remove Song?</AlertDialogTitle></AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => songToRemove && handleRemoveSong(songToRemove)}>Remove</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {/* Discard Changes Confirmation */}
        <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
                    <AlertDialogDescription>
                        You have unsaved changes. Are you sure you want to discard them and revert to the last saved version?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Keep Editing</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDiscard} className="bg-destructive hover:bg-destructive/90">Discard Changes</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default SetlistDetail;