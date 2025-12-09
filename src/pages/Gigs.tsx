import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { getGigs, saveGig, deleteGig, getSetlists } from "@/lib/api";
import { Plus, Calendar, Trash2, Loader2, MapPin, ListMusic } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Gig } from "@/types";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Link, useNavigate } from "react-router-dom";

const Gigs = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [showPast, setShowPast] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Form State
    const [newGig, setNewGig] = useState<Partial<Gig>>({ name: "", date: "", notes: "", setlist_id: null });

    const { data: gigs = [], isLoading } = useQuery({ queryKey: ['gigs'], queryFn: getGigs });
    const { data: setlists = [] } = useQuery({ queryKey: ['setlists'], queryFn: getSetlists });

    // Filter band setlists for dropdown
    const bandSetlists = useMemo(() => setlists.filter(s => !s.is_personal), [setlists]);

    const saveMutation = useMutation({
        mutationFn: saveGig,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['gigs'] });
            setIsCreateOpen(false);
            setNewGig({ name: "", date: "", notes: "", setlist_id: null });
            toast.success("Gig saved successfully");
        },
        onError: () => toast.error("Failed to save gig")
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
        const today = new Date().toISOString().split('T')[0];
        const upcoming = gigs.filter(g => g.date >= today).sort((a, b) => a.date.localeCompare(b.date));
        const past = gigs.filter(g => g.date < today).sort((a, b) => b.date.localeCompare(a.date));
        return { upcoming, past };
    }, [gigs]);

    const openCreate = () => {
        setNewGig({ name: "", date: "", notes: "", setlist_id: null });
        setIsCreateOpen(true);
    };

    const GigList = ({ list }: { list: Gig[] }) => (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {list.map(gig => (
                <Card 
                    key={gig.id} 
                    className="hover:bg-accent/40 transition-colors border shadow-sm relative group cursor-pointer"
                    onClick={() => navigate(`/gigs/${gig.id}`)}
                >
                    <CardHeader className="flex flex-row items-start justify-between pb-2">
                        <div className="space-y-1">
                            <CardTitle className="text-lg font-bold">{gig.name}</CardTitle>
                            <div className="flex items-center text-sm text-muted-foreground">
                                <Calendar className="mr-1 h-3 w-3" />
                                {new Date(gig.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                            </div>
                        </div>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); setDeleteId(gig.id); }}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
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
             <div className="space-y-6 pb-20">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sticky top-[56px] md:top-0 z-30 bg-background/95 backdrop-blur py-2">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Gigs</h1>
                        <p className="text-muted-foreground text-sm">Upcoming shows and events.</p>
                    </div>
                    <Button onClick={openCreate} className="rounded-full shadow-lg">
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

                {/* Create Dialog Only */}
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>New Gig</DialogTitle>
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
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input 
                                    type="date" 
                                    value={newGig.date || ""} 
                                    onChange={e => setNewGig(prev => ({ ...prev, date: e.target.value }))} 
                                />
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
                                <Button onClick={() => saveMutation.mutate(newGig as Gig)} disabled={!newGig.name || !newGig.date}>
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
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </AppLayout>
    );
};

export default Gigs;