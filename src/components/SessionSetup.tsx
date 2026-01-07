import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Mic2, Users, Music } from "lucide-react";

interface SessionSetupProps {
  gigId: string;
  onComplete: () => void;
}

export function SessionSetup({ gigId, onComplete }: SessionSetupProps) {
  const navigate = useNavigate();

  const handleMode = (mode: string) => {
    navigate(`/gigs/${gigId}/perform?mode=${mode}`);
    onComplete();
  };

  return (
    <div className="flex flex-col gap-3 pt-4">
      <Button onClick={() => handleMode('leader')} className="w-full justify-start gap-3" size="lg">
        <Mic2 className="h-5 w-5" />
        <div className="flex flex-col items-start">
            <span className="font-semibold">Leader</span>
            <span className="text-xs font-normal opacity-80">Control the setlist for everyone</span>
        </div>
      </Button>
      
      <Button onClick={() => handleMode('follower')} variant="secondary" className="w-full justify-start gap-3" size="lg">
        <Users className="h-5 w-5" />
        <div className="flex flex-col items-start">
            <span className="font-semibold">Follower</span>
            <span className="text-xs font-normal opacity-80">Sync with the band leader</span>
        </div>
      </Button>

      <Button onClick={() => handleMode('standalone')} variant="outline" className="w-full justify-start gap-3" size="lg">
        <Music className="h-5 w-5" />
        <div className="flex flex-col items-start">
            <span className="font-semibold">Standalone</span>
            <span className="text-xs font-normal opacity-80">Practice or perform solo</span>
        </div>
      </Button>
    </div>
  );
}