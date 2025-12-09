import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getGig, saveGig, getSetlists } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Loader2, MapPin, Calendar, Edit, ListMusic, ChevronLeft, Navigation } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Gig } from "@/types";

const GigDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAdmin } = useAuth();
    const queryClient = useQueryClient();
    
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Gig>>({});

    const { data: gig, isLoading } = useQuery({ 
        queryKey: ['gig', id], 
        queryFn: () => getGig(id!),
        enabled: !!id
    });

    const { data: setlists = [] } = useQuery({ queryKey: ['setlists'], queryFn: getSetlists });
    const bandSetlists = useMemo(() => setlists.filter(s => !s.is_personal), [setlists]);

    const saveMutation = useMutation({
        mutationFn: saveGig,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['gig', id] });
            queryClient.invalidateQueries({ queryKey: ['gigs'] }); // Refresh list view
            setIsEditOpen(false);
            toast.success("Gig updated");
        },
        onError: () => toast.error("Failed to update gig")
    });

    const handleEditOpen = () => {
        if (!gig) return;
        setEditForm({
            id: gig.id,
            name: gig.name,
            date: gig.date,
            notes: gig.notes,
            setlist_id: gig.setlist_id,
            venue_name: gig.venue_name,
            address: gig.address,
            city: gig.city,
            state: gig.state,
            zip: gig.zip
        });
        setIsEditOpen(true);
    };

    const handleNavigate = () => {
        if (!gig) return;
        const fullAddress = `${gig.address || ''}, ${gig.city || ''}, ${gig.state || ''} ${gig.zip || ''}`.trim().replace(/^,/, '').replace(/,$/, '');
        const query = gig.venue_name ? `${gig.venue_name}, ${fullAddress}` : fullAddress;
        
        if (!query) {
            toast.error("No address or venue name to navigate to.");
            return;
        }

        // Universal link that typically opens native maps on mobile or Google Maps on web
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank');
    };

    if (isLoading) return (
        <AppLayout>
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
        </AppLayout>
    );

    if (!gig) return (
        <AppLayout>
            <div className="text-center p-8">Gig not found</div>
        </AppLayout>
    );

    const isPast = new Date(gig.date) < new Date(new Date().setHours(0,0,0,0));
    const canEdit = !isPast || isAdmin;

    return (
        <AppLayout>
            <div className="space-y-6 pb-20 max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => navigate("/gigs")}>
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">{gig.name}</h1>
                            <div className="flex items-center text-muted-foreground text-sm">
                                <Calendar className="mr-1 h-3 w-3" />
                                {new Date(gig.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </div>
                        </div>
                    </div>
                    {canEdit && (
                        <Button variant="outline" size="icon" onClick={handleEditOpen}>
                            <Edit className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                {/* Details Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-primary" /> Venue Info
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <div className="font-semibold text-lg">{gig.venue_name || "Venue Name TBD"}</div>
                            <div className="text-muted-foreground">
                                {gig.address && <div>{gig.address}</div>}
                                {(gig.city || gig.state || gig.zip) && (
                                    <div>{gig.city}{gig.city && gig.state ? ', ' : ''}{gig.state} {gig.zip}</div>
                                )}
                                {!gig.address && !gig.city && <span className="italic">No address provided</span>}
                            </div>
                        </div>
                        
                        {(gig.venue_name || gig.address) && (
                            <Button onClick={handleNavigate} className="w-full sm:w-auto">
                                <Navigation className="mr-2 h-4 w-4" /> Navigate
                            </Button>
                        )}
                    </CardContent>
                </Card>

                <Card>
                     <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ListMusic className="h-5 w-5 text-primary" /> Setlist
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {gig.setlist ? (
                             <Button asChild variant="outline" className="w-full justify-start h-auto py-3">
                                <Link to={`/setlists/${gig.setlist.id}`} className="flex flex-col items-start gap-1">
                                    <span className="font-bold text-base">{gig.setlist.name}</span>
                                    <span className="text-xs text-muted-foreground font-normal">Click to view setlist details</span>
                                </Link>
                             </Button>
                        ) : (
                            <div className="text-muted-foreground italic">No setlist assigned yet.</div>
                        )}
                    </CardContent>
                </Card>

                {gig.notes && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Notes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="whitespace-pre-wrap text-sm">{gig.notes}</div>
                        </CardContent>
                    </Card>
                )}

                {/* Edit Dialog */}
                <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                    <DialogContent className="max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Edit Gig Details</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Event Name</Label>
                                <Input value={editForm.name || ""} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Date</Label>
                                <Input type="date" value={editForm.date || ""} onChange={e => setEditForm({ ...editForm, date: e.target.value })} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Venue Name</Label>
                                <Input value={editForm.venue_name || ""} onChange={e => setEditForm({ ...editForm, venue_name: e.target.value })} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Address</Label>
                                <Input value={editForm.address || ""} onChange={e => setEditForm({ ...editForm, address: e.target.value })} placeholder="123 Main St" />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-1">
                                    <Label>City</Label>
                                    <Input value={editForm.city || ""} onChange={e => setEditForm({ ...editForm, city: e.target.value })} />
                                </div>
                                <div>
                                    <Label>State</Label>
                                    <Input value={editForm.state || ""} onChange={e => setEditForm({ ...editForm, state: e.target.value })} />
                                </div>
                                <div>
                                    <Label>Zip</Label>
                                    <Input value={editForm.zip || ""} onChange={e => setEditForm({ ...editForm, zip: e.target.value })} />
                                </div>
                            </div>
                             <div className="grid gap-2">
                                <Label>Setlist</Label>
                                <Select 
                                    value={editForm.setlist_id || "none"} 
                                    onValueChange={val => setEditForm({ ...editForm, setlist_id: val === "none" ? null : val })}
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
                            <div className="grid gap-2">
                                <Label>Notes</Label>
                                <Textarea value={editForm.notes || ""} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={() => saveMutation.mutate(editForm)}>Save Changes</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
};

export default GigDetail;