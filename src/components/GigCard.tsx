import { Link } from "react-router-dom";
import { Calendar, MapPin, Users, Play } from "lucide-react";
import { format } from "date-fns";
import { Gig } from "@/types";
import { Button } from "./ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { SessionSetup } from "@/components/SessionSetup";
import { useState } from "react";

interface GigCardProps {
  gig: Gig & { setlist?: { name: string } };
}

export function GigCard({ gig }: GigCardProps) {
  const [showSession, setShowSession] = useState(false);

  return (
    <div className="group relative flex flex-col gap-2 rounded-lg border p-4 hover:bg-muted/50 transition-colors">
      <div className="flex justify-between items-start">
        <Link to={`/gigs/${gig.id}`} className="flex-1">
            <h3 className="font-semibold leading-none tracking-tight">{gig.name}</h3>
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>{format(new Date(gig.start_time), "MMM d, yyyy")}</span>
            </div>
        </Link>
        
        {/* Requirement 2: Quick Session Button on Card */}
        <Dialog open={showSession} onOpenChange={setShowSession}>
            <DialogTrigger asChild>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 -mr-2 -mt-2 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                    title="Start Session"
                >
                    <Users className="h-4 w-4 text-blue-600" />
                </Button>
            </DialogTrigger>
            <DialogContent onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                    <DialogTitle>Start Session: {gig.name}</DialogTitle>
                </DialogHeader>
                <SessionSetup gigId={gig.id} onComplete={() => setShowSession(false)} />
            </DialogContent>
        </Dialog>
      </div>

      <Link to={`/gigs/${gig.id}`} className="space-y-2">
        {gig.venue_name && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span>{gig.venue_name}</span>
            </div>
        )}
        
        {gig.setlist && (
            <div className="text-xs font-medium text-primary bg-primary/10 w-fit px-2 py-1 rounded">
            {gig.setlist.name}
            </div>
        )}
      </Link>
    </div>
  );
}