import { useMetronome } from "@/components/MetronomeContext";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, X, Minus, Plus, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetronomeControlsProps {
  variant: "mobile" | "desktop" | "embedded";
  className?: string;
}

export const MetronomeControls = ({ variant, className }: MetronomeControlsProps) => {
  const { isOpen, isPlaying, bpm, togglePlay, closeMetronome, setBpm } = useMetronome();

  if (!isOpen) return null;

  const adjustBpm = (amount: number) => {
    setBpm(Math.max(30, Math.min(300, bpm + amount)));
  };

  if (variant === "desktop") {
    return (
      <div className={cn("mt-auto border-t pt-4 bg-card", className)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <Activity className="w-4 h-4" />
            <span>Metronome</span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={closeMetronome}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => adjustBpm(-5)}>
              <Minus className="w-3 h-3" />
            </Button>
            <div className="text-xl font-mono font-bold w-12 text-center">{bpm}</div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => adjustBpm(5)}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          
          <Slider 
            value={[bpm]} 
            min={30} 
            max={250} 
            step={1} 
            onValueChange={(vals) => setBpm(vals[0])} 
          />

          <Button 
            className={cn("w-full transition-colors", isPlaying ? "bg-destructive hover:bg-destructive/90" : "")} 
            onClick={togglePlay}
          >
            {isPlaying ? (
              <>
                <Pause className="mr-2 h-4 w-4" /> Stop
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" /> Start
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Embedded Variant (for Performance Mode)
  if (variant === "embedded") {
      return (
        <div className={cn(
            "bg-background/95 backdrop-blur border-t shadow-lg p-3 animate-in slide-in-from-bottom-2",
            className
        )}>
            <div className="flex items-center justify-between gap-3 max-w-2xl mx-auto">
                <div className="flex items-center gap-2">
                     <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => adjustBpm(-1)}>
                        <Minus className="w-4 h-4" />
                    </Button>
                    <span className="font-mono font-bold text-xl w-10 text-center">{bpm}</span>
                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => adjustBpm(1)}>
                        <Plus className="w-4 h-4" />
                    </Button>
                </div>

                <Button 
                    className={cn("flex-1", isPlaying ? "bg-destructive hover:bg-destructive/90" : "")} 
                    onClick={togglePlay}
                >
                    {isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                    {isPlaying ? "Stop" : "Start"}
                </Button>

                <Button variant="ghost" size="icon" onClick={closeMetronome}>
                    <X className="w-5 h-5" />
                </Button>
            </div>
        </div>
      );
  }

  // Mobile Variant (Fixed Bottom)
  return (
    <div className={cn(
      "fixed bottom-[65px] left-0 right-0 z-40 bg-background/95 backdrop-blur border-t shadow-lg p-3 animate-in slide-in-from-bottom-10",
      className
    )}>
       <div className="flex items-center justify-between gap-3 max-w-5xl mx-auto">
          <div className="flex items-center gap-2 min-w-[100px]">
             <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => adjustBpm(-1)}>
              <Minus className="w-3 h-3" />
            </Button>
             <span className="font-mono font-bold text-lg w-8 text-center">{bpm}</span>
             <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => adjustBpm(1)}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>

          <Button 
            size="sm"
            className={cn("flex-1", isPlaying ? "bg-destructive hover:bg-destructive/90" : "")} 
            onClick={togglePlay}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" /> 
            ) : (
              <Play className="h-4 w-4" /> 
            )}
            <span className="ml-2">{isPlaying ? "Stop" : "Play"}</span>
          </Button>

          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeMetronome}>
            <X className="w-4 h-4" />
          </Button>
       </div>
    </div>
  );
};