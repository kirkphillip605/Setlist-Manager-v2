import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { 
  getSetlist, getSongs, createSet, deleteSet, 
  addSongsToSet, removeSongFromSet, updateSetSongOrder, 
  moveSetSongToSet, updateSetlist 
} from "@/lib/api";
import { parseDurationToSeconds } from "@/lib/utils";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

import { SetlistHeader } from "@/components/SetlistHeader";
import { SetCard } from "@/components/SetCard";
import { AddSongDialog } from "@/components/AddSongDialog";

const SetlistDetail = () => {
  const { id } = useParams();
  const queryClient = useQueryClient();
  
  // States
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  
  // Alerts
  const [setToDelete, setSetToDelete] = useState<string | null>(null);
  const [songToRemove, setSongToRemove] = useState<string | null>(null);

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

  const updateNameMutation = useMutation({
      mutationFn: (newName: string) => updateSetlist(id!, { name: newName }),
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['setlist', id] });
          queryClient.invalidateQueries({ queryKey: ['setlists'] });
          toast.success("Setlist renamed");
      },
      onError: () => toast.error("Failed to rename setlist")
  });

  const addSetMutation = useMutation({
    mutationFn: async () => {
      if (!setlist) return;
      if (setlist.sets.length > 0) {
          const lastSet = setlist.sets[setlist.sets.length - 1];
          if (lastSet.songs.length === 0) {
              throw new Error(`Cannot add new set. ${lastSet.name} is empty.`);
          }
      }
      const newPosition = setlist.sets.length + 1;
      return await createSet(setlist.id, `Set ${newPosition}`, newPosition);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlist', id] });
      queryClient.invalidateQueries({ queryKey: ['setlists'] }); 
      toast.success("Set added");
    },
    onError: (err: any) => toast.error(err.message)
  });

  const removeSetMutation = useMutation({
    mutationFn: (setId: string) => deleteSet(setId, setlist!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlist', id] });
      queryClient.invalidateQueries({ queryKey: ['setlists'] }); 
      setSetToDelete(null);
      toast.success("Set deleted and renumbered");
    }
  });

  const addSongsMutation = async (targetSetId: string, songIds: string[]) => {
      const targetSet = setlist?.sets.find(s => s.id === targetSetId);
      const startPosition = targetSet ? targetSet.songs.length + 1 : 1;
      await addSongsToSet(targetSetId, songIds, startPosition);
      queryClient.invalidateQueries({ queryKey: ['setlist', id] });
      queryClient.invalidateQueries({ queryKey: ['setlists'] }); 
  };

  const createSetAndAddSongsMutation = async (initialSongs: string[], remainingSongs: string[]) => {
      if (!setlist) return;
      const newPosition = setlist.sets.length + 1;
      const newSet = await createSet(setlist.id, `Set ${newPosition}`, newPosition);
      if (newSet?.id) {
          await addSongsToSet(newSet.id, remainingSongs, 1);
          queryClient.invalidateQueries({ queryKey: ['setlist', id] });
          queryClient.invalidateQueries({ queryKey: ['setlists'] }); 
      }
  };

  const removeSongMutation = useMutation({
    mutationFn: removeSongFromSet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlist', id] });
      queryClient.invalidateQueries({ queryKey: ['setlists'] }); 
      setSongToRemove(null);
      toast.success("Song removed");
    }
  });

  const reorderMutation = useMutation({
    mutationFn: updateSetSongOrder,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['setlist', id] })
  });
  
  const moveSetSongMutation = useMutation({
    mutationFn: async ({ setSongId, targetSetId }: { setSongId: string, targetSetId: string }) => {
      const targetSet = setlist?.sets.find(s => s.id === targetSetId);
      const newPosition = (targetSet?.songs.length || 0) + 1;
      await moveSetSongToSet(setSongId, targetSetId, newPosition);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlist', id] });
      toast.success("Song moved");
    }
  });

  // --- Handlers ---

  const handleMoveOrder = (setId: string, songIndex: number, direction: 'up' | 'down') => {
    if (!setlist) return;
    const set = setlist.sets.find(s => s.id === setId);
    if (!set) return;
    const songs = [...set.songs];
    const swapIndex = direction === 'up' ? songIndex - 1 : songIndex + 1;
    const itemA = songs[songIndex];
    const itemB = songs[swapIndex];
    reorderMutation.mutate([{ id: itemA.id, position: swapIndex + 1 }, { id: itemB.id, position: songIndex + 1 }]);
  };

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
        <SetlistHeader 
            name={setlist.name}
            onAddSet={() => addSetMutation.mutate()}
            isAddingSet={addSetMutation.isPending}
            onUpdateName={(name) => updateNameMutation.mutate(name)}
        />

        <div className="space-y-6">
          {setlist.sets.length === 0 ? (
             <div className="text-center py-20 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground mb-4">No sets added yet.</p>
                <Button onClick={() => addSetMutation.mutate()}>Create First Set</Button>
             </div>
          ) : (
            setlist.sets.map((set) => (
               <SetCard 
                   key={set.id}
                   set={set}
                   setlist={setlist}
                   setDuration={set.songs.reduce((acc, s) => acc + parseDurationToSeconds(s.song?.duration), 0)}
                   onAddSong={(setId) => { setActiveSetId(setId); setIsAddSongOpen(true); }}
                   onDeleteSet={setSetToDelete}
                   onRemoveSong={setSongToRemove}
                   onMoveOrder={handleMoveOrder}
                   onMoveToSet={(ssId, tsId) => moveSetSongMutation.mutate({ setSongId: ssId, targetSetId: tsId })}
               />
            ))
          )}
        </div>

        {isAddSongOpen && (
            <AddSongDialog 
                open={isAddSongOpen}
                setlist={setlist}
                activeSetId={activeSetId}
                availableSongs={availableSongs}
                onClose={() => setIsAddSongOpen(false)}
                onAddSongs={addSongsMutation}
                onCreateSetAndAdd={createSetAndAddSongsMutation}
            />
        )}

        <AlertDialog open={!!setToDelete} onOpenChange={(open) => !open && setSetToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Set?</AlertDialogTitle>
                    <AlertDialogDescription>Sets following this one will be renumbered automatically.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => setToDelete && removeSetMutation.mutate(setToDelete)} className="bg-destructive hover:bg-destructive/90">Delete Set</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!songToRemove} onOpenChange={(open) => !open && setSongToRemove(null)}>
            <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Remove Song?</AlertDialogTitle></AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => songToRemove && removeSongMutation.mutate(songToRemove)}>Remove</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default SetlistDetail;