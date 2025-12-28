import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface TempoBlinkerProps {
  bpm: number | null;
  className?: string;
}

export const TempoBlinker = ({ bpm, className }: TempoBlinkerProps) => {
  const [active, setActive] = useState(false);
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!bpm || bpm <= 0) {
        setActive(false);
        return;
    }

    const interval = 60000 / bpm; // ms per beat
    
    const animate = (time: number) => {
      if (time - lastTimeRef.current >= interval) {
        setActive(true);
        lastTimeRef.current = time;
        // Turn off shortly after
        setTimeout(() => setActive(false), 150); 
      }
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [bpm]);

  if (!bpm) return null;

  return (
    <div 
      className={cn(
        "rounded-full transition-all duration-75", 
        active 
            ? "bg-primary shadow-[0_0_15px_3px_hsl(var(--primary))]" 
            : "bg-muted-foreground/20",
        className
      )} 
    />
  );
};