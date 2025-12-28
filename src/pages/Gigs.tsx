import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { saveGig, deleteGig } from "@/lib/api";
import { Plus, Calendar, Trash2, Loader2, MapPin, ListMusic, CloudOff, MoreVertical, Clock } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Gig } from "@/types";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { useSyncedGigs, useSyncedSetlists } from "@/hooks/useSyncedData";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { LoadingDialog } from "@/components/LoadingDialog";
import { format } from "date-fns";

const Gigs = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const isOnline = useNetworkStatus();
    
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [showPast, setShowPast] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Form State
    const [newGig, setNewGig] = useState<Partial<Gig>>({ name: "", start_time: "", end_time: "", notes: "", setlist_id: null });

    // Use Master Cache
    const { data: gigs = [], isLoading } = useSyncedGigs();
    const { data: setlists = [] } = useSyncedSetlists();

    // Filter band setlists for dropdown
    const bandSetlists = useMemo(() => setlists.filter(s => !s.is_personal), [setlists]);

    const saveMutation = useMutation({
        mutationFn: saveGig,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['gigs'] });
            setIsCreateOpen(false);
            setNewGig({ name: "", start_time: "", end_time: "", notes: "", setlist_id: null });
            toast.success("Gig saved successfully");
        },
        onError: (e) => toast.error("Failed to save gig: " + e.message)
    });

    const deleteMutation = useMutation({
        mutationFn: deleteGig,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['gigs'] });
            setDeleteId(null);
            toast.success("Gig deleted");
        }
    });

    const groupedGigs = useMemo(() => {
        const now = new Date().toISOString();
        const upcoming = gigs.filter(g => g.start_time >= now).sort((a, b) => a.start_time.localeCompare(b.start_time));
        const past = gigs.filter(g => g.start_time < now).sort((a, b) => b.start_time.localeCompare(a.start_time));
        return { upcoming, past };
    }, [gigs]);

    const openCreate = () => {
        if (!isOnline) {
            toast.error("Offline: Cannot create gigs");
            return;
        }
        setNewGig({ name: "", start_time: "", end_time: "", notes: "", setlist_id: null });
        setIsCreateOpen(true);
    };

    const handleDeleteRequest = (id: string) => {
        if (!isOnline) {
            toast.error("Offline: Cannot delete gigs");
            return;
        }
        setDeleteId(id);
    };

    const handleStartTimeChange = (val: string) => {
        // Val is YYYY-MM-DDTHH:mm
        // Auto-set end time to 4 hours later
        if (val) {
            const startDate = new Date(val);
            const endDate = new Date(startDate.getTime() + 4 * 60 * 60 * 1000);
            
            // Format endDate to datetime-local string (manually to avoid timezone shift)
            // We want the literal time shifted by 4 hours. 
            // e.g. 2025-01-01T20:00 -> 2025-01-02T00:00
            
            // Native Date methods use local timezone, which matches datetime-local input behavior
            const endString = new Date(endDate.getTime() - (endDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
            
            setNewGig(prev => ({ 
                ...prev, 
                start_time: val,
                end_time: endString 
            }));
        } else {
            setNewGig(prev => ({ ...prev, start_time: val }));
        }
    };

    const GigList = ({ list }: { list: Gig[] }) => (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {list.map(gig => (
                <Card 
                    key={gig.id} 
                    className="hover:bg-accent/40 transition-colors border shadow-sm relative cursor-pointer"
                    onClick={() => navigate(`/gigs/${gig.id}`)}
                >
                    <CardHeader className="flex flex-row items-start justify-between pb-2">
                        <div className="space-y-1">
                            <CardTitle className="text-lg font-bold">{gig.name}</CardTitle>
                            <div className="flex flex-col text-sm text-muted-foreground gap-1">
                                <div className="flex items-center">
                                    <Calendar className="mr-1 h-3 w-3" />
                                    {format(new Date(gig.start_time), "EEE, MMM d, yyyy")}
                                </div>
                                <div className="flex items-center">
                                    <Clock className="mr-1 h-3 w-3" />
                                    {format(new Date(gig.start_time), "h:mm a")} 
                                    {gig.end_time && ` - ${format(new Date(gig.end_time), "h:mm a")}`}
                                </div>
                            </div>
                        </div>
                        {isOnline && (
                            <div onClick={(e) => e.stopPropagation()} className="relative z-10">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem 
                                            className="text-destructive focus:text-destructive"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteRequest(gig.id);
                                            }}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete Gig
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {gig.venue_name && (
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {gig.venue_name}
                            </div>
                        )}

                        {gig.setlist ? (
                            <div className="flex items-center gap-2 text-sm font-medium text-primary bg-primary/5 p-2 rounded">
                                <ListMusic className="h-4 w-4" />
                                Setlist: {gig.setlist.name}
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground italic bg-muted/20 p-2 rounded">
                                No setlist attached
                            </div>
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    );

    return (
        <AppLayout>
             <LoadingDialog open={saveMutation.isPending || deleteMutation.isPending} />

             <div className="space-y-6 pb-20">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sticky top-[56px] md:top-0 z-30 bg-background/95 backdrop-blur py-2">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                            Gigs
                            {!isOnline && <CloudOff className="h-5 w-5 text-muted-foreground" />}
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            {isOnline ? "Upcoming shows and events." : "Offline Mode: Read Only"}
                        </p>
                    </div>
                    {/* Desktop Button */}
                    <Button onClick={openCreate} className="hidden md:flex rounded-full shadow-lg" disabled={!isOnline}>
                        <Plus className="mr-2 h-4 w-4" /> Add Gig
                    </Button>
                </div>

                {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto" /> : (
                    <>
                        <section>
                            {groupedGigs.upcoming.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                                    <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                                    <h3 className="font-medium text-lg">No upcoming gigs</h3>
                                    <p className="text-muted-foreground">Add a gig to get started!</p>
                                </div>
                            ) : (
                                <GigList list={groupedGigs.upcoming} />
                            )}
                        </section>

                        <div className="pt-8 border-t">
                            <div className="flex items-center gap-2 mb-4">
                                <Checkbox id="showPast" checked={showPast} onCheckedChange={(c) => setShowPast(c === true)} />
                                <Label htmlFor="showPast">Show Past Gigs</Label>
                            </div>
                            {showPast && <GigList list={groupedGigs.past} />}
                        </div>
                    </>
                )}

                {/* Mobile FAB */}
                <Button
                    onClick={openCreate}
                    size="icon"
                    className="md:hidden fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+1rem)] right-4 z-40 rounded-full shadow-xl h-14 w-14 bg-primary hover:bg-primary/90 text-primary-foreground"
                    disabled={!isOnline}
                >
                    <Plus className="h-8 w-8" />
                </Button>

                {/* Create Dialog Only */}
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>New Gig</DialogTitle>
                            <DialogDescription>Enter the details for the new gig.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Gig Name (Venue/Event)</Label>
                                <Input 
                                    value={newGig.name || ""} 
                                    onChange={e => setNewGig(prev => ({ ...prev, name: e.target.value }))} 
                                    placeholder="e.g. The Blue Note" 
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Start</Label>
                                    <Input 
                                        type="datetime-local" 
                                        value={newGig.start_time || ""} 
                                        min={new Date().toISOString().slice(0, 16)}
                                        onChange={e => handleStartTimeChange(e.target.value)} 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>End</Label>
                                    <Input 
                                        type="datetime-local" 
                                        value={newGig.end_time || ""} 
                                        onChange={e => setNewGig(prev => ({ ...prev, end_time: e.target.value }))} 
                                    />
                                </div>
                            </div>
                             <div className="space-y-2">
                                <Label>Setlist</Label>
                                <Select 
                                    value={newGig.setlist_id || "none"} 
                                    onValueChange={val => setNewGig(prev => ({ ...prev, setlist_id: val === "none" ? null : val }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a setlist..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">-- No Setlist --</SelectItem>
                                        {bandSetlists.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Notes</Label>
                                <Textarea 
                                    value={newGig.notes || ""} 
                                    onChange={e => setNewGig(prev => ({ ...prev, notes: e.target.value }))} 
                                    placeholder="Load in time, parking info, etc." 
                                />
                            </div>
                            <DialogFooter>
                                <Button 
                                    onClick={() => saveMutation.mutate(newGig as Gig)} 
                                    disabled={!newGig.name || !newGig.start_time || saveMutation.isPending || !isOnline}
                                >
                                    {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Gig
                                </Button>
                            </DialogFooter>
                        </div>
                    </DialogContent>
                </Dialog>

                <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Gig?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete the gig and its details.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive" disabled={deleteMutation.isPending}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </AppLayout>
    );
};

export default Gigs;