import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Calendar, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SetlistHeaderProps {
  name: string;
  date: string;
  isTbd: boolean;
  onDateChange: (date: string) => void;
  onTbdChange: (checked: boolean) => void;
  onAddSet: () => void;
  isAddingSet: boolean;
}

export const SetlistHeader = ({ 
  name, 
  date, 
  isTbd, 
  onDateChange, 
  onTbdChange, 
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
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight truncate max-w-[200px] sm:max-w-md">{name}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                 <Checkbox 
                    id="tbd-mode" 
                    checked={isTbd}
                    onCheckedChange={(c) => onTbdChange(c === true)}
                 />
                 <Label htmlFor="tbd-mode" className="text-xs text-muted-foreground font-normal">Gig Date TBD</Label>
              </div>
              
              {!isTbd && (
                  <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <Input 
                         type="date" 
                         className="h-8 w-[140px]" 
                         value={date}
                         onChange={(e) => onDateChange(e.target.value)}
                      />
                  </div>
              )}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={onAddSet} variant="outline" disabled={isAddingSet} className="h-10">
          <Plus className="mr-2 h-4 w-4" /> Add Set
        </Button>
      </div>
    </div>
  );
};