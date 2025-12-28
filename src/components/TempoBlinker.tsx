import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface TempoBlinkerProps {
  bpm: number | null;
  color?: string; // 'red', 'green', 'blue', 'amber', 'purple'
  className?: string;
}

export const TempoBlinker = ({ bpm, color = 'amber', className }: TempoBlinkerProps) => {
  const [active, setActive] = useState(false);
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  // Map color names to Tailwind classes
  const colorMap: Record<string, string> = {
    red: "bg-red-500 shadow-[0_0_15px_3px_rgba(239,68,68,0.6)]",
    green: "bg-green-500 shadow-[0_0_15px_3px_rgba(34,197,94,0.6)]",
    blue: "bg-blue-500 shadow-[0_0_15px_3px_rgba(59,130,246,0.6)]",
    amber: "bg-amber-500 shadow-[0_0_15px_3px_rgba(245,158,11,0.6)]",
    purple: "bg-purple-500 shadow-[0_0_15px_3px_rgba(168,85,247,0.6)]",
    white: "bg-white shadow-[0_0_15px_3px_rgba(255,255,255,0.6)]",
  };

  const activeClass = colorMap[color] || colorMap['amber'];

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
            ? activeClass
            : "bg-muted-foreground/20",
        className
      )} 
    />
  );
};