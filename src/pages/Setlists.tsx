import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { 
  getSetlists, createSetlist, deleteSetlist, cloneSetlist 
} from "@/lib/api";
import { 
  Plus, Calendar, Trash2, Loader2, Copy, MoreVertical, 
  Lock, Globe, Printer, Star, Clock 
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const Setlists = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("public");
  
  // Auth Check
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
        if (!data.session) navigate('/login');
        // Simple manual refresh check on mount
        await supabase.auth.refreshSession();
    });
  }, [navigate]);

  // Create Form State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"public" | "personal" | "clone">("public");
  const [sourceSetlistId, setSourceSetlistId] = useState("");
  const [cloneType, setCloneType] = useState<"public" | "personal">("personal");
  
  const [newListName, setNewListName] = useState("");
  const [newListDate, setNewListDate] = useState("");
  const [isTbd, setIsTbd] = useState(false);
  const [isDefault, setIsDefault] = useState(false);

  // Filters
  const [showPast, setShowPast] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { data: setlists = [], isLoading } = useQuery({ queryKey: ['setlists'], queryFn: getSetlists });

  // Grouping Logic
  const groupedSetlists = useMemo(() => {
    let base = activeTab === "public" ? setlists.filter(l => !l.is_personal) : setlists.filter(l => l.is_personal);
    
    // Default
    const defaultList = base.find(l => l.is_default);
    
    // Remove default from others
    if (defaultList) base = base.filter(l => l.id !== defaultList.id);

    // Date Logic
    const today = new Date().toISOString().split('T')[0];
    
    const upcoming: any[] = [];
    const tbd: any[] = [];
    const past: any[] = [];

    base.forEach(l => {
        if (l.is_tbd) {
            tbd.push(l);
        } else if (l.date && l.date < today) {
            past.push(l);
        } else {
            upcoming.push(l);
        }
    });

    // Sort upcoming by date asc
    upcoming.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    // Sort past by date desc
    past.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    return { defaultList, upcoming, tbd, past };
  }, [setlists, activeTab]);

  const hasDefault = useMemo(() => setlists.some(l => l.is_default), [setlists]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const isPersonal = createMode === "personal" || (createMode === "clone" && cloneType === "personal");
      const date = isTbd || isPersonal ? "" : newListDate;
      
      if (createMode === "clone") {
         return cloneSetlist(sourceSetlistId, newListName, date, isPersonal);
      } else {
         return createSetlist(newListName, date, isPersonal, isTbd, isDefault);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['setlists'] });
      resetForm();
      if (data?.id) navigate(`/setlists/${data.id}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSetlist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlists'] });
      setDeleteId(null);
      toast.success("Setlist deleted");
    }
  });

  const resetForm = () => {
      setNewListName("");
      setNewListDate("");
      setIsTbd(false);
      setIsDefault(false);
      setIsCreateOpen(false);
  };

  const openCreateModal = (mode: "public" | "personal" | "clone", sourceId?: string) => {
      setCreateMode(mode);
      if (mode === "clone" && sourceId) {
          setSourceSetlistId(sourceId);
          setCloneType("personal");
          const src = setlists.find(l => l.id === sourceId);
          if (src) setNewListName(`${src.name} (Copy)`);
      }
      setIsCreateOpen(true);
  };

  const SetlistGrid = ({ lists }: { lists: any[] }) => (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lists.map(list => (
              <Link key={list.id} to={`/setlists/${list.id}`}>
                  <Card className={`hover:bg-accent/40 transition-all cursor-pointer h-full border rounded-xl shadow-sm hover:shadow-md relative group ${list.is_default ? 'border-primary/50 bg-primary/5' : ''}`}>
                      <CardHeader className="flex flex-row items-start justify-between pb-2 pr-12">
                          <div className="space-y-1">
                              <CardTitle className="text-lg font-bold truncate">{list.name}</CardTitle>
                              {list.is_default && <Badge variant="default" className="text-[10px] h-5">Default</Badge>}
                              <div className="flex items-center text-xs text-muted-foreground">
                                  {list.is_tbd ? (
                                      <><Clock className="mr-1 h-3 w-3" /> Gig Date: TBD</>
                                  ) : list.date ? (
                                      <><Calendar className="mr-1 h-3 w-3" /> {new Date(list.date).toLocaleDateString()}</>
                                  ) : null}
                              </div>
                          </div>
                      </CardHeader>
                      <CardContent>
                         <div className="text-sm text-muted-foreground">
                            {list.sets.length} Sets • {list.sets.reduce((acc: number, s: any) => acc + s.songs.length, 0)} Songs
                         </div>
                      </CardContent>
                      <div className="absolute top-2 right-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => { e.preventDefault(); e.stopPropagation(); openCreateModal("clone", list.id); }}>
                                    <Copy className="mr-2 h-4 w-4" /> Clone...
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteId(list.id); }}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                  </Card>
              </Link>
          ))}
      </div>
  );

  return (
    <AppLayout>
      <div className="space-y-6 pb-20">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sticky top-[56px] md:top-0 z-30 bg-background/95 backdrop-blur py-2">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Setlists</h1>
                <p className="text-muted-foreground text-sm">Organize your gigs.</p>
            </div>
            
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button className="rounded-full shadow-lg"><Plus className="mr-2 h-4 w-4" /> Create Setlist</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openCreateModal("public")}><Globe className="mr-2 h-4 w-4" /> Public Band Setlist</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openCreateModal("personal")}><Lock className="mr-2 h-4 w-4" /> Private Setlist</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
         </div>

         <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="public" className="gap-2"><Globe className="h-4 w-4" /> Band</TabsTrigger>
                <TabsTrigger value="personal" className="gap-2"><Lock className="h-4 w-4" /> Personal</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-8">
                {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto" /> : (
                    <>
                        {groupedSetlists.defaultList && (
                            <section>
                                <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                                    <Star className="w-4 h-4 text-primary" /> Default Setlist
                                </h3>
                                <SetlistGrid lists={[groupedSetlists.defaultList]} />
                            </section>
                        )}

                        {groupedSetlists.upcoming.length > 0 && (
                            <section>
                                <h3 className="text-sm font-medium text-muted-foreground mb-3">Upcoming Gigs</h3>
                                <SetlistGrid lists={groupedSetlists.upcoming} />
                            </section>
                        )}

                        {groupedSetlists.tbd.length > 0 && (
                            <section>
                                <h3 className="text-sm font-medium text-muted-foreground mb-3">TBD / Drafting</h3>
                                <SetlistGrid lists={groupedSetlists.tbd} />
                            </section>
                        )}

                        <div className="pt-4 border-t">
                             <div className="flex items-center gap-2 mb-4">
                                <Checkbox id="showPast" checked={showPast} onCheckedChange={(c) => setShowPast(c === true)} />
                                <Label htmlFor="showPast">Show Past Setlists</Label>
                             </div>
                             {showPast && <SetlistGrid lists={groupedSetlists.past} />}
                        </div>
                    </>
                )}
            </TabsContent>
         </Tabs>

         {/* Create Modal */}
         <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogContent>
                <DialogHeader><DialogTitle>New Setlist</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="Name..." />
                    </div>
                    {createMode === 'public' && !hasDefault && (
                        <div className="flex items-center gap-2">
                            <Checkbox id="isDef" checked={isDefault} onCheckedChange={(c) => setIsDefault(c === true)} />
                            <Label htmlFor="isDef">Make Default Band Setlist</Label>
                        </div>
                    )}
                    {createMode === 'public' && !isDefault && (
                         <div className="space-y-2">
                             <Label>Gig Date</Label>
                             <div className="flex items-center gap-2">
                                 <Input type="date" value={newListDate} onChange={e => setNewListDate(e.target.value)} disabled={isTbd} />
                                 <div className="flex items-center gap-2 whitespace-nowrap">
                                     <Checkbox id="isTbd" checked={isTbd} onCheckedChange={(c) => setIsTbd(c === true)} />
                                     <Label htmlFor="isTbd">TBD</Label>
                                 </div>
                             </div>
                         </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => createMutation.mutate()}>Create</Button>
                    </DialogFooter>
                </div>
            </DialogContent>
         </Dialog>

         {/* Delete Alert */}
         <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Setlist?</AlertDialogTitle>
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

export default Setlists;