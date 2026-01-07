import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";

interface MetronomeContextType {
  isOpen: boolean;
  isPlaying: boolean;
  bpm: number;
  openMetronome: (bpm: number) => void;
  closeMetronome: () => void;
  togglePlay: () => void;
  setBpm: (bpm: number) => void;
  previewSound: (soundType: 'click1' | 'click2' | 'click3' | 'click4' | 'click5') => void;
}

const MetronomeContext = createContext<MetronomeContextType | undefined>(undefined);

export const MetronomeProvider = ({ children }: { children: React.ReactNode }) => {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);

  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef<number>(0);
  const timerIDRef = useRef<number | null>(null);
  const lookahead = 25.0; // How frequently to call scheduling function (in milliseconds)
  const scheduleAheadTime = 0.1; // How far ahead to schedule audio (sec)

  // Preference Ref (to avoid stale closures in interval)
  const clickSoundRef = useRef<'click1' | 'click2' | 'click3' | 'click4' | 'click5'>('click1');

  useEffect(() => {
    clickSoundRef.current = profile?.preferences?.metronome_click_sound || 'click1';
  }, [profile?.preferences?.metronome_click_sound]);

  // Initialize AudioContext cleanup
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

  const playClick = (time: number, type?: 'click1' | 'click2' | 'click3' | 'click4' | 'click5') => {
    if (!audioContextRef.current) return;
    
    const osc = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);

    const soundType = type || clickSoundRef.current;

    switch (soundType) {
        case 'click2':
            osc.type = 'triangle';
            // Pitch Sweep
            osc.frequency.setValueAtTime(1000, time);
            osc.frequency.exponentialRampToValueAtTime(900, time + 0.05);
            // Envelope
            gainNode.gain.setValueAtTime(1, time);
            gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
            osc.start(time);
            osc.stop(time + 0.05);
            break;

        case 'click3':
            osc.type = 'triangle';
            // Pitch Sweep
            osc.frequency.setValueAtTime(700, time);
            osc.frequency.exponentialRampToValueAtTime(650, time + 0.03);
            // Envelope
            gainNode.gain.setValueAtTime(1, time);
            gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
            osc.start(time);
            osc.stop(time + 0.03);
            break;

        case 'click4':
            osc.type = 'sine';
            // Pitch Sweep
            osc.frequency.setValueAtTime(1500, time);
            osc.frequency.exponentialRampToValueAtTime(1200, time + 0.03);
            // Envelope
            gainNode.gain.setValueAtTime(1, time);
            gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
            osc.start(time);
            osc.stop(time + 0.03);
            break;

        case 'click5':
            osc.type = 'triangle';
            // Pitch Sweep
            osc.frequency.setValueAtTime(2000, time);
            osc.frequency.exponentialRampToValueAtTime(1900, time + 0.04);
            // Envelope
            gainNode.gain.setValueAtTime(1, time);
            gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
            osc.start(time);
            osc.stop(time + 0.04);
            break;

        case 'click1':
        default:
            osc.type = 'sine';
            // Pitch Sweep
            osc.frequency.setValueAtTime(800, time);
            osc.frequency.exponentialRampToValueAtTime(900, time + 0.05);
            // Envelope
            gainNode.gain.setValueAtTime(1, time);
            gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
            osc.start(time);
            osc.stop(time + 0.05);
            break;
    }
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

  const previewSound = async (soundType: 'click1' | 'click2' | 'click3' | 'click4' | 'click5') => {
    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
    }

    // Add 0.1s buffer to ensure we schedule in the future, avoiding jitter
    const now = audioContextRef.current.currentTime + 0.1;
    const beatLen = 0.5; // 120 BPM equivalent

    // Schedule 4 clicks
    for(let i = 0; i < 4; i++) {
        playClick(now + (i * beatLen), soundType);
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
      setBpm,
      previewSound
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