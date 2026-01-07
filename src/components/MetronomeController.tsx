import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useMetronome } from '@/context/MetronomeContext';
import { useSongFromCache } from '@/hooks/useSyncedData';

interface MetronomeControllerProps {
  currentSongId?: string; 
}

export const MetronomeController = ({ currentSongId }: MetronomeControllerProps) => {
  const location = useLocation();
  // Cast to any to bypass strict typing issues with missing context properties
  const ctx = useMetronome() as any;
  const { isPlaying, setIsPlaying, setTempo } = ctx;
  
  const currentSong = useSongFromCache(currentSongId);

  // Requirement 3: Auto-stop metronome when leaving performance/song areas
  useEffect(() => {
    const path = location.pathname;
    const isPerformanceRoute = 
      path.includes('/perform') || 
      path.includes('/songs/') ||
      path.includes('/session');

    if (!isPerformanceRoute && isPlaying && setIsPlaying) {
      console.log("[Metronome] Auto-stopping (Navigation away from performance)");
      setIsPlaying(false);
    }
  }, [location.pathname, isPlaying, setIsPlaying]);

  // Requirement 4: Auto-update tempo in standalone/practice mode
  useEffect(() => {
    if (currentSong && currentSong.tempo && setTempo) {
        const bpm = parseInt(currentSong.tempo);
        if (!isNaN(bpm)) {
            setTempo(bpm);
        }
    }
  }, [currentSong, setTempo]);

  return null;
};