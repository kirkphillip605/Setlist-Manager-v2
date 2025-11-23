import React, { createContext, useContext, useEffect, useRef, useState } from "react";

interface MetronomeContextType {
  isOpen: boolean;
  isPlaying: boolean;
  bpm: number;
  openMetronome: (bpm: number) => void;
  closeMetronome: () => void;
  togglePlay: () => void;
  setBpm: (bpm: number) => void;
}

const MetronomeContext = createContext<MetronomeContextType | undefined>(undefined);

export const MetronomeProvider = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);

  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef<number>(0);
  const timerIDRef = useRef<number | null>(null);
  const lookahead = 25.0; // How frequently to call scheduling function (in milliseconds)
  const scheduleAheadTime = 0.1; // How far ahead to schedule audio (sec)

  // Initialize AudioContext
  useEffect(() => {
    return () => {
      if (timerIDRef.current) window.clearInterval(timerIDRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const nextNote = () => {
    const secondsPerBeat = 60.0 / bpm;
    nextNoteTimeRef.current += secondsPerBeat;
  };

  const playClick = (time: number) => {
    if (!audioContextRef.current) return;
    
    const osc = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);

    // High pitch beep
    osc.frequency.value = 1000;
    
    // Short, sharp envelope
    gainNode.gain.setValueAtTime(1, time);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.start(time);
    osc.stop(time + 0.05);
  };

  const scheduler = () => {
    if (!audioContextRef.current) return;

    // while there are notes that will need to play before the next interval, 
    // schedule them and advance the pointer.
    while (nextNoteTimeRef.current < audioContextRef.current.currentTime + scheduleAheadTime) {
      playClick(nextNoteTimeRef.current);
      nextNote();
    }
  };

  const start = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // Resume context if suspended (browser autoplay policy)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    nextNoteTimeRef.current = audioContextRef.current.currentTime + 0.05;
    
    // Check purely for type safety, though start() creates it if missing
    if (timerIDRef.current) window.clearInterval(timerIDRef.current);
    timerIDRef.current = window.setInterval(scheduler, lookahead);
    
    setIsPlaying(true);
  };

  const stop = () => {
    if (timerIDRef.current) {
      window.clearInterval(timerIDRef.current);
      timerIDRef.current = null;
    }
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (isPlaying) {
      stop();
    } else {
      start();
    }
  };

  const openMetronome = (newBpm: number) => {
    // Only set BPM if it's valid
    if (newBpm && newBpm > 0) {
        setBpm(newBpm);
    }
    setIsOpen(true);
    // Auto-start
    if (!isPlaying) start();
  };

  const closeMetronome = () => {
    stop();
    setIsOpen(false);
  };

  // Ref approach for BPM to ensure scheduler sees current value without restarting interval
  const bpmRef = useRef(bpm);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);

  // Re-define nextNote to use Ref
  const nextNoteRef = useRef(() => {
      const secondsPerBeat = 60.0 / bpmRef.current;
      nextNoteTimeRef.current += secondsPerBeat;
  });

  // Re-define scheduler to use Ref
  const schedulerRef = useRef(() => {
    if (!audioContextRef.current) return;
    while (nextNoteTimeRef.current < audioContextRef.current.currentTime + scheduleAheadTime) {
        playClick(nextNoteTimeRef.current);
        nextNoteRef.current();
    }
  });

  // Keep interval in sync with running state
  useEffect(() => {
    if (isPlaying) {
        if (timerIDRef.current) clearInterval(timerIDRef.current);
        timerIDRef.current = window.setInterval(() => schedulerRef.current(), lookahead);
    }
    return () => {
        if (timerIDRef.current) clearInterval(timerIDRef.current);
    }
  }, [isPlaying]); 

  return (
    <MetronomeContext.Provider value={{
      isOpen,
      isPlaying,
      bpm,
      openMetronome,
      closeMetronome,
      togglePlay,
      setBpm
    }}>
      {children}
    </MetronomeContext.Provider>
  );
};

export const useMetronome = () => {
  const context = useContext(MetronomeContext);
  if (context === undefined) {
    throw new Error("useMetronome must be used within a MetronomeProvider");
  }
  return context;
};