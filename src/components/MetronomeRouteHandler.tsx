import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useMetronome } from "./MetronomeContext";

export const MetronomeRouteHandler = () => {
  const location = useLocation();
  const { closeMetronome, isOpen } = useMetronome();

  useEffect(() => {
    // Check if current path is "allowed" for metronome
    // Allowed: /performance/*, /songs/:id (but not /songs/new, /songs, /songs/:id/edit)
    const path = location.pathname;
    
    const isPerformance = path.startsWith('/performance');
    // Regex matches /songs/UUID but not /songs, /songs/new, or /songs/UUID/edit
    const isSongDetail = /^\/songs\/[^/]+$/.test(path) && path !== '/songs/new';
    
    // If we are NOT in an allowed path, and metronome is open, close it.
    if (isOpen && !isPerformance && !isSongDetail) {
        closeMetronome();
    }
  }, [location, isOpen, closeMetronome]);

  return null;
};