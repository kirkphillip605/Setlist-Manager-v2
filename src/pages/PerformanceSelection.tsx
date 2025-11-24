import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getSetlists } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Play, Calendar, ListMusic, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const PerformanceSelection = () => {
  const { data: setlists = [], isLoading } = useQuery({
    queryKey: ['setlists'],
    queryFn: getSetlists
  });

  return (
    <AppLayout>
      <div className="space-y-6 pb-20">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Performance Mode</h1>
          <p className="text-muted-foreground">Select a setlist to enter stage view.</p>
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
                 <h3 className="text-lg font-medium">No setlists found</h3>
                 <p className="text-muted-foreground mt-1 mb-4">
                   Create a setlist first to use Performance Mode.
                 </p>
                 <Button asChild>
                    <Link to="/setlists">Go to Setlists</Link>
                 </Button>
              </div>
            ) : (
              setlists.map((list) => (
                <Link key={list.id} to={`/performance/${list.id}`}>
                  <Card className="hover:bg-accent/40 hover:border-primary/50 transition-all duration-300 cursor-pointer h-full border group">
                    <CardHeader className="pb-2">
                       <CardTitle className="text-lg font-bold truncate">{list.name}</CardTitle>
                       <div className="flex items-center text-xs text-muted-foreground">
                          <Calendar className="mr-1 h-3 w-3" />
                          {list.date}
                       </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-medium">
                                {list.sets.reduce((acc, s) => acc + s.songs.length, 0)} Songs
                            </span>
                            <span className="text-muted-foreground text-xs">
                                {list.sets.length} Sets
                            </span>
                         </div>
                         <Button size="icon" className="rounded-full h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="h-3 w-3 ml-0.5" />
                         </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default PerformanceSelection;