import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Check, Plus, Loader2 } from "lucide-react";
import { Song, Setlist } from "@/types";
import { formatSecondsToDuration, parseDurationToSeconds } from "@/lib/utils";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface AddSongDialogProps {
    open: boolean;
    setlist: Setlist;
    activeSetId: string | null;
    availableSongs: Song[];
    onClose: () => void;
    onAddSongs: (targetSetId: string, songIds: string[]) => Promise<void>;
    onCreateSetAndAdd: (initialSongs: string[], remainingSongs: string[]) => Promise<void>;
}

const MAX_SET_DURATION = 90 * 60; // 90 mins

export const AddSongDialog = ({
    open,
    setlist,
    activeSetId,
    availableSongs,
    onClose,
    onAddSongs,
    onCreateSetAndAdd
}: AddSongDialogProps) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    // Filter Logic
    const filteredSongs = useMemo(() => {
        let result = availableSongs.filter(s => !s.is_retired);
        const term = searchTerm.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (term) {
            result = result.filter(s => 
                s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes(term) ||
                s.artist.toLowerCase().replace(/[^a-z0-9]/g, '').includes(term)
            );
        }
        return result;
    }, [availableSongs, searchTerm]);

    const activeSet = setlist.sets.find(s => s.id === activeSetId);
    
    // Duration Calcs
    const currentSetDuration = activeSet ? activeSet.songs.reduce((acc, s) => acc + parseDurationToSeconds(s.song?.duration), 0) : 0;
    
    // Split Logic
    const { batchA, batchB, projectedDuration } = useMemo(() => {
        let currentDuration = currentSetDuration;
        const batchA: string[] = [];
        const batchB: string[] = [];

        selectedIds.forEach(id => {
            const song = availableSongs.find(s => s.id === id);
            const dur = parseDurationToSeconds(song?.duration);
            
            if (currentDuration + dur <= MAX_SET_DURATION) {
                batchA.push(id);
                currentDuration += dur;
            } else {
                batchB.push(id);
            }
        });

        return { batchA, batchB, projectedDuration: currentDuration };
    }, [selectedIds, availableSongs, currentSetDuration]);

    const toggleSelection = (id: string) => {
        setSearchTerm(""); // Clear search on select
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleAdd = async () => {
        setIsProcessing(true);
        try {
            if (batchB.length > 0) {
                // We have overflow.
                // 1. Add Batch A to current set (if any)
                if (batchA.length > 0 && activeSetId) {
                    await onAddSongs(activeSetId, batchA);
                }
                // 2. Create new set and add Batch B
                await onCreateSetAndAdd(batchA, batchB); // Pass both just in case parent needs context, though mainly B
            } else {
                // Fits in one
                if (activeSetId) await onAddSongs(activeSetId, selectedIds);
            }
            setSelectedIds([]);
            onClose();
        } catch (e) {
            console.error(e);
            toast.error("Failed to add songs");
        } finally {
            setIsProcessing(false);
        }
    };

    const nextSetNumber = setlist.sets.length + 1;
    const isOverTime = batchB.length > 0;

    return (
        <Dialog open={open} onOpenChange={onClose}>
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
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                <ScrollArea className="flex-1">
                    <div className="divide-y">
                        {filteredSongs.map((song) => {
                            const isSelected = selectedIds.includes(song.id);
                            // Only check if used in OTHER sets if we want strict uniqueness per setlist? 
                            // Prompt says: "restrictions that prevent a song from being added more than once in a given setlist"
                            // So we check used IDs globally in SetlistDetail usually, but we can pass it in or calculate here.
                            // For performance, let's assume `availableSongs` are all valid or we handle dupes.
                            // Let's implement global check here:
                            const isUsed = setlist.sets.some(s => s.songs.some(ss => ss.songId === song.id));
                            
                            return (
                                <div
                                    key={song.id}
                                    className={`flex items-center p-3 gap-3 transition-colors cursor-pointer ${isUsed ? 'opacity-50 bg-muted/50' : 'hover:bg-accent/50'}`}
                                    onClick={() => !isUsed && toggleSelection(song.id)}
                                >
                                     <div className="shrink-0">
                                        {isUsed ? (
                                            <div className="w-8 h-8 flex items-center justify-center">
                                                <Check className="w-5 h-5 text-muted-foreground" />
                                            </div>
                                        ) : (
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-colors ${isSelected ? 'bg-primary text-primary-foreground border-primary' : 'border-input'}`}>
                                                {isSelected ? (
                                                    <span className="text-sm font-bold">{selectedIds.indexOf(song.id) + 1}</span>
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
                        })}
                    </div>
                </ScrollArea>

                <DialogFooter className="border-t p-4 bg-muted/10 flex-col sm:flex-row items-center gap-4 justify-between !space-x-0">
                    <div className="flex flex-col text-sm w-full">
                        <div className="flex justify-between w-full">
                            <span>Selected: <span className="font-medium">{selectedIds.length}</span></span>
                            <span>Duration: <span className={isOverTime ? "text-orange-600 font-bold" : ""}>{formatSecondsToDuration(projectedDuration)}</span></span>
                        </div>
                        {isOverTime && (
                            <div className="text-xs text-orange-600 mt-1">
                                Exceeds 90m. {batchB.length} song(s) will move to Set {nextSetNumber}.
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none h-11">Cancel</Button>
                        <Button 
                            onClick={handleAdd}
                            disabled={selectedIds.length === 0 || isProcessing}
                            className="flex-1 sm:flex-none h-11"
                        >
                            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isOverTime ? `Split & Add to Set ${nextSetNumber}` : `Add to ${activeSet?.name}`}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};