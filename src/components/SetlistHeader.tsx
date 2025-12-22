import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Edit2, Check, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

interface SetlistHeaderProps {
  name: string;
  onUpdateName: (newName: string) => void;
  children?: React.ReactNode;
}

export const SetlistHeader = ({ 
  name, 
  onUpdateName,
  children
}: SetlistHeaderProps) => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(name);

  const handleSave = () => {
      if (tempName.trim()) {
          onUpdateName(tempName);
      } else {
          setTempName(name); // Revert if empty
      }
      setIsEditing(false);
  };

  const handleCancel = () => {
      setTempName(name);
      setIsEditing(false);
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Button variant="ghost" size="icon" onClick={() => navigate("/setlists")} className="shrink-0">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        
        {isEditing ? (
            <div className="flex items-center gap-2 flex-1 max-w-md animate-in fade-in slide-in-from-left-2">
                <Input 
                    value={tempName} 
                    onChange={(e) => setTempName(e.target.value)}
                    autoFocus
                    className="h-9"
                />
                <Button size="icon" variant="ghost" onClick={handleSave} className="h-9 w-9 shrink-0 text-green-600 hover:text-green-700 hover:bg-green-50">
                    <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={handleCancel} className="h-9 w-9 shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50">
                    <X className="h-4 w-4" />
                </Button>
            </div>
        ) : (
            <div className="flex items-center gap-2 group cursor-pointer overflow-hidden" onClick={() => { setTempName(name); setIsEditing(true); }}>
                <h1 className="text-2xl font-bold tracking-tight truncate" title={name}>{name}</h1>
                <Edit2 className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
        )}
      </div>

      <div className="flex gap-2 shrink-0 items-center">
        {children}
      </div>
    </div>
  );
};