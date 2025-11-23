import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { getSetlists, createSetlist, deleteSetlist } from "@/lib/api";
import { Plus, Calendar, Trash2, Loader2, ListMusic, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const Setlists = () => {
  const [newListName, setNewListName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const queryClient = useQueryClient();

  const { data: setlists = [], isLoading } = useQuery({
    queryKey: ['setlists'],
    queryFn: getSetlists
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newListName.trim()) return;
      const date = new Date().toISOString().split('T')[0];
      return createSetlist(newListName, date);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlists'] });
      setNewListName("");
      setIsDialogOpen(false);
      toast.success("Setlist created");
    },
    onError: () => {
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

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); 
    e.stopPropagation();
    setDeleteId(id);
  };

  return (
    <AppLayout>
      <div className="space-y-6 pb-20">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sticky top-[56px] md:top-0 z-30 bg-background/95 backdrop-blur py-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Setlists</h1>
            <p className="text-muted-foreground text-sm">Organize your gigs and rehearsals.</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full shadow-lg">
                <Plus className="mr-2 h-4 w-4" /> Create Setlist
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>New Setlist</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Input 
                    placeholder="Setlist Name (e.g. Summer Gig)" 
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    className="h-11"
                  />
                </div>
                <Button 
                  onClick={() => createMutation.mutate()} 
                  className="w-full"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {setlists.length === 0 ? (
               <div className="col-span-full text-center py-20">
                 <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <ListMusic className="w-8 h-8 text-muted-foreground" />
                 </div>
                 <h3 className="text-lg font-medium">No setlists yet</h3>
                 <p className="text-muted-foreground mt-1 mb-4">
                   Create your first setlist to get started.
                 </p>
                 <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
                    Create Setlist
                 </Button>
              </div>
            ) : (
              setlists.map((list) => (
                <Link key={list.id} to={`/setlists/${list.id}`}>
                  <Card className="hover:bg-accent/40 transition-all duration-300 cursor-pointer h-full border rounded-xl shadow-sm hover:shadow-md group">
                    <CardHeader className="flex flex-row items-start justify-between pb-2">
                      <div className="space-y-1">
                         <CardTitle className="text-lg font-bold truncate leading-none">{list.name}</CardTitle>
                         <div className="flex items-center text-xs text-muted-foreground">
                            <Calendar className="mr-1 h-3 w-3" />
                            {list.date}
                         </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => handleDeleteClick(e, list.id)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
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
                        <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        )}

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