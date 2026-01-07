import { useParams, useNavigate, Link } from "react-router-dom";
import { useSyncedGigs } from "@/hooks/useSyncedData";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, MapPin, Edit, Trash, PlayCircle, Users } from "lucide-react";
import { format } from "date-fns";
import { useStore } from "@/lib/store";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SessionSetup } from "@/components/SessionSetup";

export default function GigDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: gigs } = useSyncedGigs();
  const gig = gigs.find((g) => g.id === id);
  const [showSessionDialog, setShowSessionDialog] = useState(false);

  if (!gig) {
    return (
      <div className="p-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="mt-8 text-center text-muted-foreground">Gig not found</div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)} className="pl-0">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        
        <div className="flex gap-2">
           {/* Requirement 2: Start Session Button */}
           <Dialog open={showSessionDialog} onOpenChange={setShowSessionDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50">
                <Users className="h-4 w-4" />
                Session
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start Gig Session</DialogTitle>
              </DialogHeader>
              <SessionSetup gigId={gig.id} onComplete={() => setShowSessionDialog(false)} />
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="icon" asChild>
            <Link to={`/gigs/${gig.id}/edit`}>
              <Edit className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold">{gig.name}</h1>
          {gig.setlist && (
            <Link to={`/setlists/${gig.setlist.id}`} className="text-muted-foreground hover:underline">
              {gig.setlist.name}
            </Link>
          )}
        </div>

        <div className="flex flex-col gap-2 text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>{format(new Date(gig.start_time), "PPP p")}</span>
          </div>
          {(gig.venue_name || gig.city) && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>
                {[gig.venue_name, gig.city, gig.state].filter(Boolean).join(", ")}
              </span>
            </div>
          )}
        </div>

        {gig.notes && (
            <div className="bg-muted/50 p-4 rounded-lg text-sm">
                {gig.notes}
            </div>
        )}

        <div className="pt-4">
            <Button className="w-full gap-2" size="lg" asChild>
                <Link to={`/gigs/${gig.id}/perform`}>
                    <PlayCircle className="h-5 w-5" />
                    Perform Gig
                </Link>
            </Button>
        </div>
      </div>
    </div>
  );
}