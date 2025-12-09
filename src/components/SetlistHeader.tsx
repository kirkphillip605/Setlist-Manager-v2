import { Button } from "@/components/ui/button";
import { ChevronLeft, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SetlistHeaderProps {
  name: string;
  onAddSet: () => void;
  isAddingSet: boolean;
}

export const SetlistHeader = ({ 
  name, 
  onAddSet,
  isAddingSet
}: SetlistHeaderProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sticky top-0 z-10 bg-background/95 backdrop-blur py-4 border-b">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/setlists")}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight truncate max-w-[200px] sm:max-w-md">{name}</h1>
      </div>
      <div className="flex gap-2">
        <Button onClick={onAddSet} variant="outline" disabled={isAddingSet} className="h-10">
          <Plus className="mr-2 h-4 w-4" /> Add Set
        </Button>
      </div>
    </div>
  );
};