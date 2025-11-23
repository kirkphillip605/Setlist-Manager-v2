import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSong, deleteSong } from "@/lib/api";
import { useEffect, useState } from "react";
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
  Loader2
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 flex flex-col items-center text-center bg-secondary/10">
            <span className="text-xs text-muted-foreground uppercase mb-1">Artist</span>
            <span className="font-semibold">{song.artist}</span>
          </Card>
          
          <Card className="p-4 flex flex-col items-center text-center bg-secondary/10">
            <div className="flex items-center gap-1 mb-1">
              <Music2 className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase">Key</span>
            </div>
            <span className="font-semibold">{song.key || "-"}</span>
          </Card>
          
          <Card className="p-4 flex flex-col items-center text-center bg-secondary/10">
             <div className="flex items-center gap-1 mb-1">
              <Timer className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase">Tempo</span>
            </div>
            <span className="font-semibold">{song.tempo ? `${song.tempo} BPM` : "-"}</span>
          </Card>

          <Card className="p-4 flex flex-col items-center text-center bg-secondary/10">
            <div className="flex items-center gap-1 mb-1">
              <StickyNote className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase">Note</span>
            </div>
            <span className="font-semibold truncate w-full" title={song.note || ""}>{song.note || "-"}</span>
          </Card>
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