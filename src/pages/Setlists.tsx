import { useSyncedSetlists } from "@/hooks/useSyncedData";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Music, Calendar } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function Setlists() {
  const { data: setlists, isLoading } = useSyncedSetlists();

  if (isLoading) {
    return (
      <div className="container max-w-2xl mx-auto p-4 space-y-4">
        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
        <div className="space-y-2">
            {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Setlists</h1>
        <Button asChild size="sm">
          <Link to="/setlists/new">
            <Plus className="h-4 w-4 mr-2" />
            New
          </Link>
        </Button>
      </div>

      <div className="grid gap-4">
        {setlists.map((setlist: any) => (
          <Link
            key={setlist.id}
            to={`/setlists/${setlist.id}`}
            className="flex flex-col gap-1 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{setlist.name}</h3>
              {setlist.is_personal && (
                 <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">Personal</span>
              )}
            </div>
            
            <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{setlist.date ? format(new Date(setlist.date), 'MMM d, yyyy') : 'No date'}</span>
                </div>
                <div className="flex items-center gap-1">
                    <Music className="h-3.5 w-3.5" />
                    <span>{setlist.sets?.reduce((acc: any, s: any) => acc + (s.songs?.length || 0), 0) || 0} songs</span>
                </div>
            </div>
          </Link>
        ))}

        <Link
            to="/setlists/new"
            className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
        >
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <Plus className="h-6 w-6" />
            </div>
            <span className="font-medium">Create New Setlist</span>
        </Link>
      </div>
    </div>
  );
}