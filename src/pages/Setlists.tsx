import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getSetlists, saveSetlist, deleteSetlist } from "@/lib/storage";
import { Setlist } from "@/types";
import { Plus, Calendar, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const Setlists = () => {
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [newListName, setNewListName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const loadData = () => {
    setSetlists(getSetlists());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = () => {
    if (!newListName.trim()) return;
    
    const newSetlist: Setlist = {
      id: crypto.randomUUID(),
      name: newListName,
      date: new Date().toISOString().split('T')[0],
      sets: []
    };
    
    saveSetlist(newSetlist);
    setNewListName("");
    setIsDialogOpen(false);
    loadData();
    toast.success("Setlist created");
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); // Prevent navigation
    deleteSetlist(id);
    loadData();
    toast.success("Setlist deleted");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Setlists</h1>
            <p className="text-muted-foreground">Organize your gigs.</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Create Setlist
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Setlist</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Input 
                    placeholder="Setlist Name (e.g. Summer Gig)" 
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                  />
                </div>
                <Button onClick={handleCreate} className="w-full">Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {setlists.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground bg-accent/20 rounded-lg border border-dashed">
              No setlists created yet.
            </div>
          ) : (
            setlists.map((list) => (
              <Link key={list.id} to={`/setlists/${list.id}`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg font-bold truncate">{list.name}</CardTitle>
                    <Button variant="ghost" size="icon" onClick={(e) => handleDelete(e, list.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-sm text-muted-foreground mb-2">
                      <Calendar className="mr-2 h-4 w-4" />
                      {list.date}
                    </div>
                    <div className="text-sm font-medium">
                      {list.sets.length} Sets • {list.sets.reduce((acc, set) => acc + set.songs.length, 0)} Songs
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Setlists;