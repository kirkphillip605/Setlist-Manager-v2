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
import { Plus, Calendar, Trash2, Loader2, ListMusic, ChevronRight, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Setlist } from "@/types";

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

  const handlePrintClick = (e: React.MouseEvent, list: Setlist) => {
    e.preventDefault();
    e.stopPropagation();

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
            
            body { 
              font-family: 'Inter', sans-serif; 
              margin: 0; 
              padding: 0; 
              color: #1a1a1a;
            }
            
            @media print {
              @page { margin: 1cm; size: portrait; }
              .page-break { page-break-after: always; }
              body { -webkit-print-color-adjust: exact; }
            }

            .set-page {
              height: 95vh;
              display: flex;
              flex-direction: column;
              padding: 2rem;
              box-sizing: border-box;
            }

            header {
              text-align: center;
              margin-bottom: 2rem;
              border-bottom: 2px solid #000;
              padding-bottom: 1rem;
            }

            h1 { font-size: 3rem; margin: 0; line-height: 1.2; text-transform: uppercase; }
            h2 { font-size: 1.5rem; margin: 0.5rem 0 0; color: #555; font-weight: 600; }

            .songs-table {
              width: 100%;
              border-collapse: collapse;
              flex: 1;
            }

            .songs-table th {
              text-align: left;
              border-bottom: 1px solid #999;
              padding: 0.5rem;
              font-size: 0.9rem;
              text-transform: uppercase;
              color: #666;
            }

            .songs-table td {
              padding: 0.75rem 0.5rem;
              border-bottom: 1px solid #eee;
              font-size: 1.25rem;
              vertical-align: middle;
            }

            .col-pos { width: 5%; color: #888; font-weight: bold; }
            .col-title { width: 40%; font-weight: 700; font-size: 1.4rem; }
            .col-artist { width: 25%; }
            .col-meta { width: 10%; font-family: monospace; }
            .col-note { width: 20%; font-style: italic; color: #555; }
            
            .meta-badge {
              display: inline-block;
              padding: 2px 6px;
              border: 1px solid #ccc;
              border-radius: 4px;
              font-size: 0.8em;
              margin-right: 4px;
            }
          </style>
        </head>
        <body>
          ${list.sets.map(set => `
            <div class="set-page">
              <header>
                <h1>${list.name}</h1>
                <h2>${set.name}</h2>
              </header>
              
              <table class="songs-table">
                <thead>
                  <tr>
                    <th class="col-pos">#</th>
                    <th class="col-title">Title</th>
                    <th class="col-artist">Artist</th>
                    <th class="col-meta">Key</th>
                    <th class="col-meta">BPM</th>
                    <th class="col-note">Note</th>
                  </tr>
                </thead>
                <tbody>
                  ${set.songs.map((s, idx) => `
                    <tr>
                      <td class="col-pos">${idx + 1}</td>
                      <td class="col-title">${s.song?.title || 'Unknown Title'}</td>
                      <td class="col-artist">${s.song?.artist || 'Unknown Artist'}</td>
                      <td class="col-meta">${s.song?.key || '-'}</td>
                      <td class="col-meta">${s.song?.tempo || '-'}</td>
                      <td class="col-note">${s.song?.note || ''}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <div class="page-break"></div>
          `).join('')}
          <script>
            window.onload = () => { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;

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
                      <div className="flex -mr-2 -mt-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" title="Print PDF" onClick={(e) => handlePrintClick(e, list)}>
                          <Printer className="h-4 w-4 text-muted-foreground hover:text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => handleDeleteClick(e, list.id)}>
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
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