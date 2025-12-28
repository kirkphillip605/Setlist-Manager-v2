import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { deleteGig } from "@/lib/api";
import { Plus, Calendar, Trash2, Loader2, MapPin, ListMusic, CloudOff, MoreVertical, Clock, ChevronRight } from "lucide-react";
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
import { Link, useNavigate } from "react-router-dom";
import { useSyncedGigs, useSyncedSetlists } from "@/hooks/useSyncedData";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { LoadingDialog } from "@/components/LoadingDialog";
import { format, parseISO } from "date-fns";
import { GigCreateWizard } from "@/components/GigCreateWizard";

const Gigs = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const isOnline = useNetworkStatus();
    
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [showPast, setShowPast] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Use Master Cache
    const { data: gigs = [], isLoading } = useSyncedGigs();
    const { data: setlists = [] } = useSyncedSetlists();

    // Filter band setlists for wizard (only public/band lists)
    const bandSetlists = useMemo(() => setlists.filter(s => !s.is_personal), [setlists]);

    const deleteMutation = useMutation({
        mutationFn: deleteGig,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['gigs'] });
            setDeleteId(null);
            toast.success("Gig deleted");
        },
        onError: (e: any) => toast.error("Failed to delete gig: " + (e.message || "Unknown error"))
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
        setIsCreateOpen(true);
    };

    const handleDeleteRequest = (id: string) => {
        if (!isOnline) {
            toast.error("Offline: Cannot delete gigs");
            return;
        }
        setDeleteId(id);
    };

    const GigList = ({ list }: { list: Gig[] }) => (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {list.map(gig => (
                <div key={gig.id} className="relative group">
                    <Link to={`/gigs/${gig.id}`} className="block">
                        <Card className="hover:bg-accent/40 transition-colors border shadow-sm h-full relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <CardHeader className="flex flex-row items-start justify-between pb-2 pr-10">
                                <div className="space-y-1">
                                    <CardTitle className="text-lg font-bold">{gig.name}</CardTitle>
                                    <div className="flex flex-col text-sm text-muted-foreground gap-1">
                                        <div className="flex items-center">
                                            <Calendar className="mr-1.5 h-3.5 w-3.5" />
                                            {format(parseISO(gig.start_time), "EEE, MMM d, yyyy")}
                                        </div>
                                        <div className="flex items-center">
                                            <Clock className="mr-1.5 h-3.5 w-3.5" />
                                            {format(parseISO(gig.start_time), "h:mm a")} 
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {gig.venue_name && (
                                    <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                                        <MapPin className="h-3.5 w-3.5" /> 
                                        <span className="truncate">{gig.venue_name}</span>
                                    </div>
                                )}

                                {gig.setlist ? (
                                    <div className="flex items-center gap-2 text-sm font-medium text-primary bg-primary/5 p-2 rounded border border-primary/10">
                                        <ListMusic className="h-4 w-4" />
                                        <span className="truncate">{gig.setlist.name}</span>
                                    </div>
                                ) : (
                                    <div className="text-sm text-muted-foreground italic bg-muted/20 p-2 rounded border border-transparent">
                                        No setlist attached
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </Link>
                </div>
            ))}
        </div>
    );

    return (
        <AppLayout>
             <LoadingDialog open={deleteMutation.isPending} />

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

                {/* New Wizard Component */}
                <GigCreateWizard 
                    open={isCreateOpen}
                    onClose={() => setIsCreateOpen(false)}
                    setlists={bandSetlists}
                />

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