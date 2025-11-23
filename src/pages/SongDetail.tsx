import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSong, deleteSong } from "@/lib/api";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  ChevronLeft, 
  Edit, 
  Trash2, 
  Music2, 
  Timer, 
  StickyNote,
  Loader2,
  ExternalLink,
  Music
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const SongDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: song, isLoading } = useQuery({
    queryKey: ['song', id],
    queryFn: () => getSong(id!),
    enabled: !!id
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSong,
    onSuccess: () => {
      toast.success("Song deleted");
      queryClient.invalidateQueries({ queryKey: ['songs'] });
      navigate("/songs");
    },
    onError: () => {
      toast.error("Failed to delete song");
    }
  });

  const handleDelete = () => {
    if (id) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) return (
    <AppLayout>
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </AppLayout>
  );

  if (!song) return (
    <AppLayout>
      <div className="text-center p-8">Song not found</div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="space-y-6 pb-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/songs")}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight truncate max-w-[200px] sm:max-w-md">
              {song.title}
            </h1>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="icon">
              <Link to={`/songs/${id}/edit`}>
                <Edit className="h-4 w-4" />
              </Link>
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete song?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete "{song.title}".
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Hero Section with Art */}
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <div className="shrink-0 mx-auto sm:mx-0">
             {song.cover_url ? (
               <img 
                 src={song.cover_url} 
                 alt={song.title} 
                 className="w-48 h-48 rounded-lg shadow-md object-cover"
               />
             ) : (
               <div className="w-48 h-48 rounded-lg shadow-md bg-secondary flex items-center justify-center">
                 <Music className="w-16 h-16 text-muted-foreground opacity-50" />
               </div>
             )}
          </div>

          <div className="flex-1 w-full space-y-4">
             <div>
               <h2 className="text-2xl font-semibold">{song.title}</h2>
               <p className="text-lg text-muted-foreground">{song.artist}</p>
             </div>
             
             {song.spotify_url && (
               <Button asChild variant="outline" className="gap-2 text-[#1DB954] hover:text-[#1DB954] border-[#1DB954]/20 hover:bg-[#1DB954]/10">
                 <a href={song.spotify_url} target="_blank" rel="noopener noreferrer">
                   <Music className="w-4 h-4" />
                   Open in Spotify
                   <ExternalLink className="w-3 h-3 ml-1" />
                 </a>
               </Button>
             )}

             <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                <Card className="p-3 flex flex-col items-center text-center bg-secondary/10">
                  <div className="flex items-center gap-1 mb-1">
                    <Music2 className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground uppercase">Key</span>
                  </div>
                  <span className="font-semibold">{song.key || "-"}</span>
                </Card>
                
                <Card className="p-3 flex flex-col items-center text-center bg-secondary/10">
                   <div className="flex items-center gap-1 mb-1">
                    <Timer className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground uppercase">Tempo</span>
                  </div>
                  <span className="font-semibold">{song.tempo ? `${song.tempo} BPM` : "-"}</span>
                </Card>

                <Card className="p-3 flex flex-col items-center text-center bg-secondary/10 col-span-2 sm:col-span-1">
                  <div className="flex items-center gap-1 mb-1">
                    <StickyNote className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground uppercase">Note</span>
                  </div>
                  <span className="font-semibold truncate w-full" title={song.note || ""}>{song.note || "-"}</span>
                </Card>
             </div>
          </div>
        </div>

        <Card className="min-h-[400px] p-6 bg-card relative">
          <pre className="whitespace-pre-wrap font-mono text-sm sm:text-base leading-relaxed">
            {song.lyrics || "No lyrics/chords added."}
          </pre>
        </Card>
      </div>
    </AppLayout>
  );
};

export default SongDetail;