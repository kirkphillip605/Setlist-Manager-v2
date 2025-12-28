import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, MapPin, Check, ChevronRight, ChevronLeft, Keyboard, Globe } from "lucide-react";
import { Gig, Setlist } from "@/types";
import { searchVenues, saveGig } from "@/lib/api";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface GigCreateWizardProps {
    open: boolean;
    onClose: () => void;
    setlists: Setlist[];
}

export const GigCreateWizard = ({ open, onClose, setlists }: GigCreateWizardProps) => {
    const [step, setStep] = useState(1);
    // New state for Step 2 sub-modes
    const [venueMode, setVenueMode] = useState<'select' | 'search' | 'manual'>('select');
    
    const [formData, setFormData] = useState<Partial<Gig>>({
        name: "",
        start_time: "",
        end_time: "",
        notes: "",
        venue_name: "",
        address: "",
        city: "",
        state: "",
        zip: "",
        setlist_id: null
    });

    const queryClient = useQueryClient();

    // Auto-select default setlist on mount
    useEffect(() => {
        if (open) {
            setStep(1);
            setVenueMode('select');
            setFormData(prev => ({
                name: "",
                start_time: "",
                end_time: "",
                notes: "",
                venue_name: "",
                address: "",
                city: "",
                state: "",
                zip: "",
                setlist_id: setlists.find(s => s.is_default)?.id || null
            }));
        }
    }, [open, setlists]);

    // --- STEP 1 LOGIC ---
    const handleStartTimeChange = (val: string) => {
        if (val) {
            const date = new Date(val);
            date.setHours(date.getHours() + 4);
            const offset = date.getTimezoneOffset() * 60000;
            const endString = new Date(date.getTime() - offset).toISOString().slice(0, 16);
            
            setFormData(prev => ({ ...prev, start_time: val, end_time: endString }));
        } else {
            setFormData(prev => ({ ...prev, start_time: val }));
        }
    };

    // --- STEP 2 LOGIC (Venue Search) ---
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [hasSearched, setHasSearched] = useState(false);

    // Ensure at least 2 words
    const isValidQuery = searchQuery.trim().split(/\s+/).length >= 2;

    const handleSearch = async () => {
        if (!searchQuery.trim() || !isValidQuery) return;
        
        setIsSearching(true);
        setHasSearched(true);
        
        try {
            const results = await searchVenues(searchQuery);
            setSearchResults(results);
            if (results.length === 0) toast.info("No venues found");
        } catch (e) {
            toast.error("Venue search failed");
        } finally {
            setIsSearching(false);
        }
    };

    const selectVenue = (item: any) => {
        setFormData(prev => ({
            ...prev,
            venue_name: item.title,
            address: `${item.address.houseNumber || ''} ${item.address.street || ''}`.trim(),
            city: item.address.city,
            state: item.address.stateCode,
            zip: item.address.postalCode
        }));
        toast.success("Venue details applied");
        setStep(3); // Auto-advance
    };

    // --- FINAL SUBMISSION ---
    const saveMutation = useMutation({
        mutationFn: saveGig,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['gigs'] });
            onClose();
            toast.success("Gig created successfully");
        },
        onError: (e: any) => toast.error("Failed to create gig: " + e.message)
    });

    const handleNext = () => {
        if (step === 1 && !formData.name) return;
        setStep(step + 1);
    };

    const handleBack = () => {
        // If we are in Step 2 sub-modes (search/manual), go back to select
        if (step === 2 && venueMode !== 'select') {
            setVenueMode('select');
            return;
        }
        setStep(step - 1);
    };

    // Helper to determine if "Next" button should be visible/enabled
    const showNextButton = step !== 2 || venueMode === 'manual';
    const isNextDisabled = (step === 1 && !formData.name);

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b shrink-0">
                    <DialogTitle>Create New Gig</DialogTitle>
                    <DialogDescription>
                        Step {step} of 3: {step === 1 ? "Basic Details" : step === 2 ? "Venue Location" : "Setlist"}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden relative bg-muted/10">
                    {/* STEP 1: BASICS */}
                    {step === 1 && (
                        <ScrollArea className="h-full">
                            <div className="p-6 space-y-6">
                                <div className="space-y-2">
                                    <Label>Gig Name <span className="text-destructive">*</span></Label>
                                    <Input 
                                        value={formData.name} 
                                        onChange={e => setFormData({ ...formData, name: e.target.value })} 
                                        placeholder="e.g. Summer Festival Main Stage"
                                        autoFocus
                                    />
                                    <p className="text-xs text-muted-foreground">This is how the gig will appear on your dashboard.</p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Start Time</Label>
                                        <Input 
                                            type="datetime-local" 
                                            value={formData.start_time} 
                                            onChange={e => handleStartTimeChange(e.target.value)} 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>End Time (Optional)</Label>
                                        <Input 
                                            type="datetime-local" 
                                            value={formData.end_time} 
                                            onChange={e => setFormData({ ...formData, end_time: e.target.value })} 
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Notes</Label>
                                    <Textarea 
                                        value={formData.notes} 
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })} 
                                        placeholder="Load in details, contact info, parking..." 
                                        className="h-32"
                                    />
                                </div>
                            </div>
                        </ScrollArea>
                    )}

                    {/* STEP 2: VENUE - SELECT MODE */}
                    {step === 2 && venueMode === 'select' && (
                        <div className="p-6 h-full flex flex-col items-center justify-center space-y-6">
                            <div className="text-center space-y-2 max-w-sm mx-auto">
                                <h3 className="text-lg font-semibold">Location Details</h3>
                                <p className="text-sm text-muted-foreground">How would you like to enter the venue information?</p>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-4 w-full max-w-sm">
                                <Card 
                                    className="cursor-pointer hover:border-primary hover:bg-primary/5 transition-all group"
                                    onClick={() => setVenueMode('search')}
                                >
                                    <CardContent className="flex items-center gap-4 p-4">
                                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                            <Globe className="w-5 h-5" />
                                        </div>
                                        <div className="text-left">
                                            <div className="font-semibold">Search Venue</div>
                                            <div className="text-xs text-muted-foreground">Auto-fill address from maps</div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground" />
                                    </CardContent>
                                </Card>

                                <Card 
                                    className="cursor-pointer hover:border-primary hover:bg-primary/5 transition-all group"
                                    onClick={() => setVenueMode('manual')}
                                >
                                    <CardContent className="flex items-center gap-4 p-4">
                                        <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center text-foreground group-hover:scale-110 transition-transform">
                                            <Keyboard className="w-5 h-5" />
                                        </div>
                                        <div className="text-left">
                                            <div className="font-semibold">Enter Manually</div>
                                            <div className="text-xs text-muted-foreground">Type address details yourself</div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground" />
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: VENUE - SEARCH MODE */}
                    {step === 2 && venueMode === 'search' && (
                        <div className="flex flex-col h-full">
                            <div className="p-4 bg-background border-b space-y-4">
                                <div className="flex gap-2">
                                    <Input 
                                        placeholder="Search venue (e.g. Docs Bar Watertown SD)" 
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && isValidQuery && handleSearch()}
                                        autoFocus
                                    />
                                    <Button onClick={handleSearch} disabled={isSearching || !isValidQuery}>
                                        {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                            
                            <div className="flex-1 min-h-0 bg-background">
                                <ScrollArea className="h-full">
                                    {searchResults.length === 0 ? (
                                        <div className="p-8 text-center text-muted-foreground text-sm space-y-4">
                                            {hasSearched ? (
                                                <>
                                                    <p>No venues found.</p>
                                                    <div className="p-3 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-md border border-amber-500/20 text-xs">
                                                        <p className="font-semibold mb-1">Tip for better results:</p>
                                                        <p>Include <b>City & State</b> or <b>Zip Code</b> along with the venue name.</p>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground/50">
                                                    <Search className="w-12 h-12 mb-2" />
                                                    <p>Search above to find a venue</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="divide-y">
                                            {searchResults.map((item: any) => (
                                                <div 
                                                    key={item.id} 
                                                    className="p-4 hover:bg-accent cursor-pointer transition-colors flex items-center justify-between group"
                                                    onClick={() => selectVenue(item)}
                                                >
                                                    <div>
                                                        <div className="font-medium">{item.title}</div>
                                                        <div className="text-xs text-muted-foreground">{item.address.label}</div>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-50 group-hover:opacity-100" />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: VENUE - MANUAL MODE */}
                    {step === 2 && venueMode === 'manual' && (
                        <ScrollArea className="h-full bg-background">
                            <div className="p-6 space-y-4">
                                <div className="text-sm font-medium border-b pb-2 mb-2">Venue Details</div>
                                <div className="space-y-2">
                                    <Label>Venue Name</Label>
                                    <Input value={formData.venue_name} onChange={e => setFormData({...formData, venue_name: e.target.value})} autoFocus />
                                </div>
                                <div className="space-y-2">
                                    <Label>Address</Label>
                                    <Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-2">
                                        <Label>City</Label>
                                        <Input value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>State</Label>
                                        <Input value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Zip</Label>
                                    <Input value={formData.zip} onChange={e => setFormData({...formData, zip: e.target.value})} />
                                </div>
                            </div>
                        </ScrollArea>
                    )}

                    {/* STEP 3: SETLIST */}
                    {step === 3 && (
                        <div className="p-6 h-full flex flex-col items-center justify-center space-y-6">
                            <div className="w-full max-w-sm space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-base">Select Setlist</Label>
                                    <Select 
                                        value={formData.setlist_id || "none"} 
                                        onValueChange={val => setFormData({ ...formData, setlist_id: val === "none" ? null : val })}
                                    >
                                        <SelectTrigger className="h-12">
                                            <SelectValue placeholder="Choose a setlist..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">-- No Setlist --</SelectItem>
                                            {setlists.map(s => (
                                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-sm text-muted-foreground">
                                        A setlist is required for performance mode features. You can change this later.
                                    </p>
                                </div>

                                <Card className="p-4 bg-primary/5 border-primary/20">
                                    <div className="text-sm font-medium mb-2">Gig Summary</div>
                                    <ul className="text-sm space-y-1 text-muted-foreground">
                                        <li><span className="font-semibold text-foreground">Name:</span> {formData.name}</li>
                                        <li><span className="font-semibold text-foreground">Date:</span> {formData.start_time ? new Date(formData.start_time).toLocaleDateString() : "TBD"}</li>
                                        <li><span className="font-semibold text-foreground">Venue:</span> {formData.venue_name || "TBD"}</li>
                                    </ul>
                                </Card>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-4 border-t bg-background flex flex-row justify-between sm:justify-between items-center">
                    <Button variant="ghost" onClick={step === 1 ? onClose : handleBack}>
                        {step === 1 ? "Cancel" : <><ChevronLeft className="mr-2 h-4 w-4" /> Back</>}
                    </Button>
                    
                    <div className="flex gap-2">
                        {step < 3 ? (
                            showNextButton && (
                                <Button onClick={handleNext} disabled={isNextDisabled}>
                                    Next <ChevronRight className="ml-2 h-4 w-4" />
                                </Button>
                            )
                        ) : (
                            <Button 
                                onClick={() => saveMutation.mutate(formData as Gig)} 
                                disabled={saveMutation.isPending || !formData.setlist_id}
                            >
                                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Gig
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};