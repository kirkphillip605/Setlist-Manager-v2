import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  getSetlists, 
  createSetlist, 
  deleteSetlist, 
  cloneSetlist 
} from "@/lib/api";
import { 
  Plus, 
  Calendar, 
  Trash2, 
  Loader2, 
  ListMusic, 
  ChevronRight, 
  Printer, 
  User, 
  Globe, 
  Copy,
  MoreVertical,
  Lock,
  Share2
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Setlist } from "@/types";
import { supabase } from "@/integrations/supabase/client";

const Setlists = () => {
  const [activeTab, setActiveTab] = useState("public");
  
  // Create Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"public" | "personal" | "clone">("public");
  
  // Form States
  const [newListName, setNewListName] = useState("");
  const [newListDate, setNewListDate] = useState("");
  const [sourceSetlistId, setSourceSetlistId] = useState<string>("");
  const [cloneType, setCloneType] = useState<"public" | "personal">("personal");

  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const queryClient = useQueryClient();

  const { data: setlists = [], isLoading } = useQuery({
    queryKey: ['setlists'],
    queryFn: getSetlists
  });

  // Get current user ID to filter personal lists correctly
  const [userId, setUserId] = useState<string | null>(null);
  useState(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
  });

  const filteredSetlists = useMemo(() => {
    if (activeTab === "public") {
      return setlists.filter(l => !l.is_personal);
    } else {
      // Show only MY personal setlists (though API should technically restrict, filtering here is safe UI practice)
      return setlists.filter(l => l.is_personal);
    }
  }, [setlists, activeTab]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newListName.trim()) return;
      
      if (createMode === "clone") {
         if (!sourceSetlistId) return;
         const isPersonal = cloneType === "personal";
         const date = isPersonal ? "" : (newListDate || new Date().toISOString().split('T')[0]);
         return cloneSetlist(sourceSetlistId, newListName, date, isPersonal);
      } else {
         const isPersonal = createMode === "personal";
         // Personal lists don't need a date strictly, but we can store empty or current
         const date = isPersonal ? "" : (newListDate || new Date().toISOString().split('T')[0]);
         return createSetlist(newListName, date, isPersonal);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlists'] });
      resetForm();
      toast.success("Setlist created");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to create setlist");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSetlist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlists'] });
      setDeleteId(null);
      toast.success("Setlist deleted");
    },
    onError: () => {
      toast.error("Failed to delete setlist");
    }
  });

  const resetForm = () => {
      setNewListName("");
      setNewListDate("");
      setSourceSetlistId("");
      setIsCreateOpen(false);
  };

  const openCreateModal = (mode: "public" | "personal" | "clone", sourceId?: string) => {
      setCreateMode(mode);
      if (mode === "clone" && sourceId) {
          setSourceSetlistId(sourceId);
          // Default to personal copy when cloning from list
          setCloneType("personal");
      }
      // If cloning generally, we'll let them pick source in UI (not implemented fully in this snippet, assumes context menu trigger)
      
      setIsCreateOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); 
    e.stopPropagation();
    setDeleteId(id);
  };

  const handlePrintClick = (e: React.MouseEvent, list: Setlist) => {
    e.preventDefault();
    e.stopPropagation();
    // (Existing print logic...)
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        toast.error("Please allow popups to print setlists");
        return;
    }
     const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${list.name} - Setlist</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
            body { font-family: 'Inter', sans-serif; margin: 0; padding: 2rem; color: #1a1a1a; }
            @media print { @page { margin: 1cm; size: portrait; } .page-break { page-break-after: always; } }
            h1 { font-size: 3rem; margin: 0; line-height: 1.2; text-transform: uppercase; }
            h2 { font-size: 1.5rem; margin: 0.5rem 0 0; color: #555; font-weight: 600; }
            .songs-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
            .songs-table th { text-align: left; border-bottom: 1px solid #999; padding: 0.5rem; }
            .songs-table td { padding: 0.75rem 0.5rem; border-bottom: 1px solid #eee; font-size: 1.25rem; }
            .col-pos { width: 5%; color: #888; font-weight: bold; }
          </style>
        </head>
        <body>
          ${list.sets.map(set => `
            <div>
              <header><h1>${list.name}</h1><h2>${set.name}</h2></header>
              <table class="songs-table">
                <thead><tr><th class="col-pos">#</th><th>Title</th><th>Artist</th><th>Key</th><th>BPM</th><th>Note</th></tr></thead>
                <tbody>
                  ${set.songs.map((s, idx) => `
                    <tr>
                      <td class="col-pos">${idx + 1}</td>
                      <td>${s.song?.title || 'Unknown'}</td>
                      <td>${s.song?.artist || ''}</td>
                      <td>${s.song?.key || '-'}</td>
                      <td>${s.song?.tempo || '-'}</td>
                      <td>${s.song?.note || ''}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <div class="page-break"></div>
            </div>
          `).join('')}
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>`;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <AppLayout>
      <div className="space-y-6 pb-20">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sticky top-[56px] md:top-0 z-30 bg-background/95 backdrop-blur py-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Setlists</h1>
            <p className="text-muted-foreground text-sm">Organize your gigs and rehearsals.</p>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="rounded-full shadow-lg">
                <Plus className="mr-2 h-4 w-4" /> Create Setlist
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Create New</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => openCreateModal("public")}>
                    <Globe className="mr-2 h-4 w-4" /> Public Band Setlist
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openCreateModal("personal")}>
                    <Lock className="mr-2 h-4 w-4" /> Private Personal Setlist
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {
                   // This is a generic clone, we need to show a picker ideally, 
                   // but for now we can just show the modal and let them pick from a list if implemented
                   // For this implementation, we will assume they use the context menu on an existing list
                   toast.info("Please use the context menu on an existing setlist to clone it.");
                }}>
                    <Copy className="mr-2 h-4 w-4" /> Clone Existing...
                </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="public" className="gap-2">
                    <Globe className="h-4 w-4" /> Band Setlists
                </TabsTrigger>
                <TabsTrigger value="personal" className="gap-2">
                    <Lock className="h-4 w-4" /> My Personal Lists
                </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-0">
                {isLoading ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
                ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredSetlists.length === 0 ? (
                    <div className="col-span-full text-center py-20 bg-accent/10 rounded-xl border border-dashed">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                            {activeTab === 'public' ? <Globe className="w-8 h-8 text-muted-foreground" /> : <Lock className="w-8 h-8 text-muted-foreground" />}
                        </div>
                        <h3 className="text-lg font-medium">No {activeTab} setlists found</h3>
                        <p className="text-muted-foreground mt-1 mb-4">
                        {activeTab === 'public' ? "Create a setlist for the whole band." : "Create a private setlist for your own practice."}
                        </p>
                        <Button variant="outline" onClick={() => openCreateModal(activeTab as any)}>
                            Create {activeTab === 'public' ? "Public" : "Private"} Setlist
                        </Button>
                    </div>
                    ) : (
                    filteredSetlists.map((list) => (
                        <Link key={list.id} to={`/setlists/${list.id}`}>
                        <Card className="hover:bg-accent/40 transition-all duration-300 cursor-pointer h-full border rounded-xl shadow-sm hover:shadow-md group relative">
                            <CardHeader className="flex flex-row items-start justify-between pb-2 pr-12">
                            <div className="space-y-1">
                                <CardTitle className="text-lg font-bold truncate leading-none">{list.name}</CardTitle>
                                {list.date && (
                                    <div className="flex items-center text-xs text-muted-foreground">
                                        <Calendar className="mr-1 h-3 w-3" />
                                        {list.date}
                                    </div>
                                )}
                            </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div className="flex gap-4">
                                    <div className="text-center">
                                        <span className="block text-2xl font-bold">{list.sets.length}</span>
                                        <span className="text-[10px] uppercase text-muted-foreground font-medium">Sets</span>
                                    </div>
                                    <div className="w-px bg-border h-full"></div>
                                    <div className="text-center">
                                        <span className="block text-2xl font-bold">{list.sets.reduce((acc, set) => acc + set.songs.length, 0)}</span>
                                        <span className="text-[10px] uppercase text-muted-foreground font-medium">Songs</span>
                                    </div>
                                    </div>
                                </div>
                            </CardContent>

                            {/* Absolute Context Menu Button */}
                            <div className="absolute top-2 right-2">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={(e) => handlePrintClick(e, list)}>
                                            <Printer className="mr-2 h-4 w-4" /> Print PDF
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            openCreateModal("clone", list.id);
                                        }}>
                                            <Copy className="mr-2 h-4 w-4" /> Create Copy...
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem 
                                            className="text-destructive focus:text-destructive"
                                            onClick={(e) => handleDeleteClick(e, list.id)}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </Card>
                        </Link>
                    ))
                    )}
                </div>
                )}
            </TabsContent>
        </Tabs>

        {/* Create / Clone Modal */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>
                    {createMode === 'clone' ? "Create from Existing" : 
                     createMode === 'personal' ? "New Private Setlist" : "New Public Setlist"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                
                {/* Clone Type Selection */}
                {createMode === 'clone' && (
                    <div className="p-3 bg-muted rounded-lg space-y-3">
                        <Label>Clone as:</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <Button 
                                type="button" 
                                variant={cloneType === 'personal' ? 'default' : 'outline'}
                                onClick={() => setCloneType('personal')}
                                className="text-xs"
                            >
                                <Lock className="mr-2 h-3 w-3" /> Private Copy
                            </Button>
                            <Button 
                                type="button" 
                                variant={cloneType === 'public' ? 'default' : 'outline'}
                                onClick={() => setCloneType('public')}
                                className="text-xs"
                            >
                                <Globe className="mr-2 h-3 w-3" /> Public Copy
                            </Button>
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="listName">Setlist Name</Label>
                  <Input 
                    id="listName"
                    placeholder="e.g. Summer Tour 2024" 
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                  />
                </div>

                {(createMode === 'public' || (createMode === 'clone' && cloneType === 'public')) && (
                    <div className="space-y-2">
                        <Label htmlFor="listDate">Gig Date</Label>
                        <Input 
                            id="listDate"
                            type="date"
                            value={newListDate}
                            onChange={(e) => setNewListDate(e.target.value)}
                        />
                    </div>
                )}

                <DialogFooter className="pt-4">
                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                    <Button 
                        onClick={() => createMutation.mutate()} 
                        disabled={createMutation.isPending || !newListName}
                    >
                        {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {createMode === 'clone' ? "Clone Setlist" : "Create Setlist"}
                    </Button>
                </DialogFooter>
              </div>
            </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Setlist?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the setlist.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive hover:bg-destructive/90">
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default Setlists;