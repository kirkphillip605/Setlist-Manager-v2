import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  addSkippedSong, removeSkippedSong, updateSessionState, 
  endGigSession, requestLeadership, forceLeadership, resolveLeadershipRequest,
  leaveGigSession, getGigSession, joinGigSession
} from "@/lib/api";
import { Song, GigSession } from "@/types";
import { Button } from "@/components/ui/button";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from "@/components/ui/dialog";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  ChevronLeft, ChevronRight, Search, Loader2, Music, Minimize2, Menu, Timer, Edit, Forward, Check, CloudOff, Users, Crown, Radio, LogOut, AlertTriangle, Wifi, WifiOff, History, ZoomIn, ZoomOut, List
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMetronome } from "@/components/MetronomeContext";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MetronomeControls } from "@/components/MetronomeControls";
import { useSetlistWithSongs, useSyncedSongs, useSyncedSkippedSongs } from "@/hooks/useSyncedData";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useGigSession } from "@/hooks/useGigSession";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { TempoBlinker } from "@/components/TempoBlinker";
import { useAuth } from "@/context/AuthContext";
import { useGesture } from "@use-gesture/react";

const PerformanceMode = () => {
  const { id } = useParams(); // Setlist ID
  const [searchParams] = useSearchParams();
  const gigId = searchParams.get('gigId');
  const initialStandalone = searchParams.get('standalone') === 'true';
  const isOnline = useNetworkStatus();
  const { profile } = useAuth();

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openMetronome, isOpen: isMetronomeOpen, bpm, closeMetronome } = useMetronome();
  
  // -- Preferences --
  const blinkerEnabled = profile?.preferences?.tempo_blinker_enabled !== false;
  const blinkerColor = profile?.preferences?.tempo_blinker_color || 'amber';
  const viewMode = profile?.preferences?.performance_view || 'full';

  // -- Failover State --
  const [isForcedStandalone, setIsForcedStandalone] = useState(initialStandalone);
  const [offlineCountdown, setOfflineCountdown] = useState<number | null>(null);
  const [previousSessionId, setPreviousSessionId] = useState<string | null>(null);
  
  // Recovery Dialogs
  const [recoveryData, setRecoveryData] = useState<{ type: 'leader' | 'follower', session: any } | null>(null);

  // -- Zoom State --
  const [fontSize, setFontSize] = useState(() => {
      const saved = localStorage.getItem("lyrics_font_size");
      return saved ? parseInt(saved) : 24; // Default 24px
  });

  const handleZoom = (delta: number) => {
      setFontSize(prev => {
          const newState = Math.min(Math.max(prev + delta, 12), 120);
          localStorage.setItem("lyrics_font_size", newState.toString());
          return newState;
      });
  };

  // Determine effective mode for Logic
  const isGigMode = !!gigId && !isForcedStandalone;

  // -- Session Hook --
  const { sessionData, participants, isLeader, loading: sessionLoading, userId } = useGigSession(isGigMode ? gigId : null);

  // Local State
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [tempSong, setTempSong] = useState<Song | null>(null);

  // -- Orphaned Session State (Heartbeat Monitor) --
  const [isOrphaned, setIsOrphaned] = useState(false);
  
  useEffect(() => {
      if (!isGigMode || isLeader || !sessionData) {
          setIsOrphaned(false);
          return;
      }

      const checkHeartbeat = () => {
          const last = new Date(sessionData.last_heartbeat).getTime();
          const now = Date.now();
          if (now - last > 10 * 60 * 1000) {
              setIsOrphaned(true);
          } else {
              setIsOrphaned(false);
          }
      };

      checkHeartbeat();
      const interval = setInterval(checkHeartbeat, 30000); 
      return () => clearInterval(interval);
  }, [sessionData, isGigMode, isLeader]);

  // -- Offline Failover Logic --
  useEffect(() => {
      let timer: number;
      
      if (isOnline || isForcedStandalone || !isLeader) {
          setOfflineCountdown(null);
          return;
      }

      if (!isOnline && isGigMode && isLeader && offlineCountdown === null) {
          setOfflineCountdown(30);
      }

      if (offlineCountdown !== null && offlineCountdown > 0) {
          timer = window.setTimeout(() => setOfflineCountdown(c => (c && c > 0 ? c - 1 : 0)), 1000);
      } else if (offlineCountdown === 0) {
          handleSwitchToStandalone();
      }

      return () => clearTimeout(timer);
  }, [isOnline, isForcedStandalone, isLeader, isGigMode, offlineCountdown]);

  const handleSwitchToStandalone = () => {
      setOfflineCountdown(null);
      if (sessionData) {
          setPreviousSessionId(sessionData.id);
      }
      setIsForcedStandalone(true);
      toast.info("Switched to Standalone Mode");
  };

  // -- Online Recovery Logic --
  useEffect(() => {
      const checkRecovery = async () => {
          if (isOnline && isForcedStandalone && previousSessionId && gigId) {
              try {
                  const session = await getGigSession(gigId);
                  
                  if (!session || !session.is_active) {
                      setPreviousSessionId(null); 
                      return;
                  }

                  if (session.leader_id === userId) {
                      setRecoveryData({ type: 'leader', session });
                  } else {
                      setRecoveryData({ type: 'follower', session });
                  }
              } catch (e) {
                  console.error("Error checking session recovery", e);
              }
          }
      };
      checkRecovery();
  }, [isOnline, isForcedStandalone, previousSessionId, gigId, userId]);

  const handleRecoveryConfirm = async () => {
      if (!recoveryData) return;

      if (recoveryData.type === 'leader') {
          await updateSessionState(recoveryData.session.id, {
              current_set_index: currentSetIndex,
              current_song_index: currentSongIndex,
              adhoc_song_id: tempSong?.id || null
          });
          await forceLeadership(recoveryData.session.id, userId!);
          
          setIsForcedStandalone(false);
          toast.success("Resumed Gig Session");
      } else {
          await joinGigSession(recoveryData.session.id, userId!);
          setIsForcedStandalone(false);
          toast.success("Rejoined Session as Follower");
      }
      setRecoveryData(null);
  };

  const handleRecoveryDecline = async () => {
      if (!recoveryData) return;

      if (recoveryData.type === 'leader') {
          await endGigSession(recoveryData.session.id);
          toast.info("Gig Session Ended. Remaining in Standalone.");
      } else {
          await leaveGigSession(recoveryData.session.id, userId!);
          toast.info("Left Session. Remaining in Standalone.");
      }
      
      setPreviousSessionId(null); 
      setRecoveryData(null);
  };

  // -- Derived Data --
  const setlist = useSetlistWithSongs(id);
  const { data: allSongs = [] } = useSyncedSongs();
  const { data: allSkipped = [] } = useSyncedSkippedSongs();

  const skippedSongs = useMemo(() => {
      if (!gigId) return [];
      return allSkipped
        .filter((entry: any) => entry.gig_id === gigId)
        .map((entry: any) => entry.song)
        .filter(Boolean) as Song[];
  }, [allSkipped, gigId]);

  const sets = useMemo(() => {
      if (!setlist) return [];
      return setlist.sets; 
  }, [setlist]);

  // -- Sync Effect (Follower Logic) --
  useEffect(() => {
      if (isGigMode && sessionData && !isLeader) {
          setCurrentSetIndex(sessionData.current_set_index);
          setCurrentSongIndex(sessionData.current_song_index);
          if (sessionData.adhoc_song_id) {
              const found = allSongs.find(s => s.id === sessionData.adhoc_song_id);
              if (found) setTempSong(found);
          } else {
              setTempSong(null);
          }
      }
  }, [sessionData, isGigMode, isLeader, allSongs]);

  const broadcastState = async (setIdx: number, songIdx: number, adhocId: string | null) => {
      if (isGigMode && isLeader && sessionData) {
          await updateSessionState(sessionData.id, {
              current_set_index: setIdx,
              current_song_index: songIdx,
              adhoc_song_id: adhocId
          });
      }
  };

  // -- Navigation Handlers --
  const handleNext = () => {
    if (tempSong) {
      setTempSong(null);
      if (isLeader) broadcastState(currentSetIndex, currentSongIndex, null);
      return;
    }
    if (!setlist) return; 
    
    const currentSet = sets[currentSetIndex];
    if (!currentSet) return;

    let nextSetIdx = currentSetIndex;
    let nextSongIdx = currentSongIndex;

    if (currentSongIndex < currentSet.songs.length - 1) {
      nextSongIdx++;
    } else if (currentSetIndex < sets.length - 1) {
      nextSetIdx++;
      nextSongIdx = 0;
    }

    setCurrentSetIndex(nextSetIdx);
    setCurrentSongIndex(nextSongIdx);
    
    if (isLeader) broadcastState(nextSetIdx, nextSongIdx, null);
  };

  const handlePrev = () => {
    if (tempSong) {
      setTempSong(null);
      if (isLeader) broadcastState(currentSetIndex, currentSongIndex, null);
      return;
    }
    if (!setlist) return;

    let nextSetIdx = currentSetIndex;
    let nextSongIdx = currentSongIndex;

    if (currentSongIndex > 0) {
      nextSongIdx--;
    } else if (currentSetIndex > 0) {
      nextSetIdx--;
      const prevSet = sets[nextSetIdx];
      nextSongIdx = prevSet.songs.length - 1;
    }

    setCurrentSetIndex(nextSetIdx);
    setCurrentSongIndex(nextSongIdx);

    if (isLeader) broadcastState(nextSetIdx, nextSongIdx, null);
  };

  const handleSetChange = (value: string) => {
    const index = parseInt(value);
    if (!isNaN(index)) {
      setTempSong(null);
      setCurrentSetIndex(index);
      setCurrentSongIndex(0);
      if (isLeader) broadcastState(index, 0, null);
    }
  };

  const handleAdHocSelect = (song: Song) => {
      setTempSong(song);
      setIsSearchOpen(false);
      setSearchQuery("");
      if (isLeader) broadcastState(currentSetIndex, currentSongIndex, song.id);
  };

  const handleSkipSong = async () => {
      if (!gigId || !activeSong) return;
      await addSkippedSong(gigId, activeSong.id);
      toast.info("Song skipped");
      handleNext();
  };

  const handleRestoreSkippedSong = async (song: Song) => {
      if (!gigId) return;
      await removeSkippedSong(gigId, song.id);
      handleAdHocSelect(song);
      setShowSkippedSongs(false);
      toast.success("Playing skipped song");
  };

  // -- UI States --
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showSkippedSongs, setShowSkippedSongs] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showLeaderRequest, setShowLeaderRequest] = useState(false);
  const [incomingRequest, setIncomingRequest] = useState<any>(null);
  const [showSetSongsDialog, setShowSetSongsDialog] = useState(false);

  // -- Listen for Incoming Leadership Requests --
  useEffect(() => {
      if (!isLeader || !sessionData) return;
      const channel = supabase.channel(`leader_req:${sessionData.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leadership_requests', filter: `session_id=eq.${sessionData.id}` }, 
        async (payload) => {
            if (payload.new.status === 'pending') {
                const { data: user } = await supabase.from('profiles').select('first_name, last_name').eq('id', payload.new.requester_id).single();
                setIncomingRequest({ ...payload.new, userName: `${user?.first_name} ${user?.last_name}` });
            }
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
  }, [isLeader, sessionData]);

  // -- Listen for Session End --
  const [sessionEndedInfo, setSessionEndedInfo] = useState<{ endedBy: string, at: string } | null>(null);
  
  useEffect(() => {
      if (isGigMode && sessionData && !sessionData.is_active && !isForcedStandalone) {
           setSessionEndedInfo({
              endedBy: "Leader",
              at: new Date(sessionData.ended_at || new Date()).toLocaleTimeString()
          });
      }
      if(isGigMode && !sessionLoading && sessionData === null && sessionEndedInfo === null && !isForcedStandalone) {
          setSessionEndedInfo({
              endedBy: "Leader",
              at: new Date().toLocaleTimeString()
          });
      }
  }, [sessionData, isGigMode, isForcedStandalone, sessionLoading]);

  // -- Leadership Actions --
  const handleRequestLeadership = async () => {
      if (!sessionData || !userId) return;
      const now = new Date().getTime();
      const lastBeat = new Date(sessionData.last_heartbeat).getTime();
      const diff = (now - lastBeat) / 1000;

      if (diff > 30 || isOrphaned) {
          await forceLeadership(sessionData.id, userId);
          toast.success("You are now the leader.");
          setShowLeaderRequest(false);
          setIsOrphaned(false);
      } else {
          await requestLeadership(sessionData.id, userId);
          toast.info("Request sent to current leader.");
          setShowLeaderRequest(false);
      }
  };

  const handleResolveRequest = async (approved: boolean) => {
      if (!incomingRequest) return;
      await resolveLeadershipRequest(incomingRequest.id, approved ? 'approved' : 'denied');
      if (approved && userId) {
          await forceLeadership(sessionData!.id, incomingRequest.requester_id);
          toast.success("Leadership transferred.");
      }
      setIncomingRequest(null);
  };

  const handleTransferAndLeave = async (newLeaderId: string) => {
      if (!sessionData) return;
      await forceLeadership(sessionData.id, newLeaderId);
      if (userId) await leaveGigSession(sessionData.id, userId);
      navigate('/gigs');
  };

  const handleEndSession = async () => {
      if (!sessionData) return;
      await endGigSession(sessionData.id);
      navigate('/gigs');
  };

  const handleFollowerExit = async () => {
      if (sessionData && userId) {
          try {
              await leaveGigSession(sessionData.id, userId);
          } catch (e) {
              console.error("Failed to leave session cleanly", e);
          }
      }
      navigate(initialStandalone ? '/performance' : '/gigs');
  };

  // -- Render Helpers --
  const currentSet = sets[currentSetIndex];
  const activeSong = tempSong || currentSet?.songs[currentSongIndex]?.song;
  const filteredSongs = allSongs.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.artist.toLowerCase().includes(searchQuery.toLowerCase()));
  const showMetronome = !gigId;

  // Next Song Calculation
  const nextSong = useMemo(() => {
      if (tempSong) return null; // Ad-hoc has no "next" in sequence
      if (!currentSet) return null;
      if (currentSongIndex < currentSet.songs.length - 1) {
          return currentSet.songs[currentSongIndex + 1].song;
      }
      // End of set? check next set
      if (currentSetIndex < sets.length - 1) {
          const nextSet = sets[currentSetIndex + 1];
          if (nextSet.songs.length > 0) return nextSet.songs[0].song;
      }
      return null;
  }, [currentSet, currentSongIndex, currentSetIndex, sets, tempSong]);

  // -- Gestures --
  const bind = useGesture({
    onPinch: ({ offset: [d] }) => {
        // d is basically zoom level. Default scale is 1.
        // We map d to a reasonable font size change.
        // Assume baseline 24px is at scale 1 (or offset 0 depending on config).
        // Let's just use delta for simpler relative zooming
    },
    onPinchEnd: ({ offset: [d] }) => {
        // Alternative: Use a ref to track pinch delta and apply to font size
    },
    // Simple pinch handler using delta
    onPinchIn: ({ cancel }) => {
       handleZoom(-2);
    },
    onPinchOut: ({ cancel }) => {
       handleZoom(2);
    },
    onDragEnd: ({ swipe: [swipeX] }) => {
        // Horizontal swipe navigation
        if (swipeX === -1) { // Swipe Left -> Next
            handleNext();
        } else if (swipeX === 1) { // Swipe Right -> Prev
            handlePrev();
        }
    }
  }, {
      drag: { axis: 'x', filterTaps: true, threshold: 50 },
      pinch: { scaleBounds: { min: 0.5, max: 3 } }
  });

  if (!setlist || (isGigMode && sessionLoading)) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (isGigMode && sessionEndedInfo && !isForcedStandalone) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
              <Radio className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-2xl font-bold mb-2">Session Ended</h2>
              <p className="text-muted-foreground mb-6">
                  Performance ended by <span className="font-bold">{sessionEndedInfo.endedBy}</span> at {sessionEndedInfo.at}.
              </p>
              <div className="flex gap-4">
                  <Button onClick={() => navigate('/gigs')}>Go to Gigs</Button>
                  <Button variant="outline" onClick={() => navigate('/')}>Dashboard</Button>
              </div>
          </div>
      );
  }

  // --- SIMPLE VIEW RENDERER ---
  const renderSimpleView = () => (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-12 touch-pan-y" {...bind()}>
          {activeSong ? (
              <>
                  <div className="space-y-4">
                      <h2 className="text-5xl md:text-7xl font-bold leading-tight tracking-tight select-none">{activeSong.title}</h2>
                      <p className="text-3xl md:text-4xl text-muted-foreground select-none">{activeSong.artist}</p>
                  </div>
                  
                  <div className="flex flex-wrap gap-8 justify-center">
                      <div className="bg-secondary/30 p-6 rounded-2xl min-w-[160px] border border-border/50">
                          <div className="text-xl text-muted-foreground uppercase font-semibold mb-2 select-none">Key</div>
                          <div className="text-5xl font-bold select-none">{activeSong.key || "-"}</div>
                      </div>
                      <div className="bg-secondary/30 p-6 rounded-2xl min-w-[160px] border border-border/50">
                          <div className="text-xl text-muted-foreground uppercase font-semibold mb-2 select-none">Tempo</div>
                          <div className="text-5xl font-bold select-none">{activeSong.tempo ? `${activeSong.tempo}` : "-"}</div>
                      </div>
                  </div>

                  {activeSong.note && (
                      <div className="bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 px-8 py-4 rounded-xl text-2xl font-medium max-w-2xl select-none">
                          {activeSong.note}
                      </div>
                  )}
              </>
          ) : (
              <div className="text-muted-foreground text-2xl select-none">Waiting for song...</div>
          )}
      </div>
  );

  // --- FULL VIEW RENDERER ---
  const renderFullView = () => (
      <div className="p-4 md:p-8 max-w-4xl mx-auto min-h-full pb-32 touch-pan-y" {...bind()}>
        {activeSong ? (
          <div className="space-y-6">
            {/* Title & Artist moved here */}
            <div className="text-center border-b pb-4 mb-4">
                <h2 className="text-3xl md:text-4xl font-bold leading-tight select-none">{activeSong.title}</h2>
                <p className="text-xl text-muted-foreground select-none">{activeSong.artist}</p>
            </div>
            
            <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-6">
                {activeSong.key && <Badge variant="secondary" className="text-sm select-none">Key: {activeSong.key}</Badge>}
                {activeSong.tempo && <Badge variant="secondary" className="text-sm select-none">{activeSong.tempo} BPM</Badge>}
                {activeSong.note && <div className="bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 px-3 py-1 rounded text-sm select-none">{activeSong.note}</div>}
            </div>

            <div 
                className="whitespace-pre-wrap font-mono leading-relaxed transition-all duration-200 select-none"
                style={{ fontSize: `${fontSize}px` }}
            >
              {activeSong.lyrics || <span className="text-muted-foreground italic text-base">No lyrics available.</span>}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground select-none">
            <Music className="h-16 w-16 mb-4 opacity-20" />
            <p>{isLeader || initialStandalone || isForcedStandalone ? "Select a song to begin" : "Waiting for leader..."}</p>
          </div>
        )}
      </div>
  );

  return (
    <div className="fixed inset-0 bg-background text-foreground flex flex-col z-50">
      
      {/* Alerts */}
      <AlertDialog open={offlineCountdown !== null}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                      <WifiOff className="h-5 w-5" /> Connection Lost
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                      Unable to reach the server. Switching to Standalone Mode in <b>{offlineCountdown}</b> seconds.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogAction onClick={handleSwitchToStandalone}>Switch Immediately</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!recoveryData}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-green-600">
                      <Wifi className="h-5 w-5" /> Connection Restored
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                      {recoveryData?.type === 'leader' 
                        ? "Your session is still active. Do you want to re-enter and sync your current position?"
                        : "The session is still active, but there is a new leader. Join as a follower?"
                      }
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={handleRecoveryDecline}>
                      {recoveryData?.type === 'leader' ? "No, End Session" : "No, Stay Standalone"}
                  </AlertDialogCancel>
                  <AlertDialogAction onClick={handleRecoveryConfirm}>
                      {recoveryData?.type === 'leader' ? "Yes, Resume Session" : "Yes, Join Session"}
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isOrphaned && !isForcedStandalone}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
                      <AlertTriangle className="h-5 w-5" /> Connection Lost
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                      We haven't received updates from the leader for over 10 minutes.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4 space-y-3">
                  <p className="text-sm font-medium">Waiting for leader to rejoin...</p>
                  <div className="flex gap-2">
                      <Button className="flex-1" onClick={handleRequestLeadership}>
                          <Crown className="mr-2 h-4 w-4" /> Become Leader
                      </Button>
                      <Button variant="destructive" className="flex-1" onClick={() => {
                          if(sessionData) endGigSession(sessionData.id);
                      }}>
                          End Session
                      </Button>
                  </div>
              </div>
          </AlertDialogContent>
      </AlertDialog>

      {/* --- Top Bar (Larger Height: h-16 / 4rem) --- */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card shadow-sm shrink-0 h-16 gap-3 relative z-40">
        <div className="flex-1 max-w-[280px] shrink-0 flex items-center gap-2">
          {!isOnline && <CloudOff className="h-4 w-4 text-muted-foreground" />}
          {isLeader || !isGigMode ? (
              <div className="flex items-center gap-2 w-full">
                  <Select value={currentSetIndex.toString()} onValueChange={handleSetChange} disabled={!!tempSong}>
                    <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Select Set" /></SelectTrigger>
                    <SelectContent>
                      {sets.map((set, idx) => <SelectItem key={set.id} value={idx.toString()}>{set.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => setShowSetSongsDialog(true)}>
                      <List className="h-5 w-5" />
                  </Button>
              </div>
          ) : (
              <div className="bg-muted px-3 py-2 rounded text-sm font-medium flex items-center gap-2">
                  <Radio className="h-3 w-3 text-green-500 animate-pulse" /> Following
              </div>
          )}
        </div>
        
        {/* Spacer for potential center elements if needed, otherwise empty */}
        <div className="flex-1" />

        <div className="flex items-center justify-end gap-2 flex-1 shrink-0">
            {/* Blinker */}
            {isGigMode && activeSong?.tempo && blinkerEnabled && (
                <TempoBlinker 
                    bpm={parseInt(activeSong.tempo)} 
                    color={blinkerColor}
                    className="w-6 h-6 mr-3 shrink-0" 
                />
            )}

            {/* Skip Button */}
            {isLeader && isGigMode && activeSong && !tempSong && isOnline && (
                 <Button variant="outline" size="sm" className="text-orange-600 border-orange-200 hover:bg-orange-50 h-10" onClick={handleSkipSong}>
                     <Forward className="w-4 h-4 mr-2" /> Skip
                 </Button>
            )}
            
            {isGigMode && isLeader ? (
                <Button variant="ghost" size="sm" onClick={() => setShowExitConfirm(true)} className="h-10 text-destructive hover:text-destructive">
                    <span className="mr-2 hidden sm:inline">End Gig</span>
                    <LogOut className="h-5 w-5" />
                </Button>
            ) : (
                <Button variant="ghost" size="sm" onClick={handleFollowerExit} className="h-10">
                    Exit <Minimize2 className="h-5 w-5 ml-2" />
                </Button>
            )}
        </div>
      </div>

      {/* --- Main Content --- */}
      <div className="flex-1 overflow-hidden relative bg-background">
        <ScrollArea className="h-full w-full">
            {viewMode === 'simple' ? renderSimpleView() : renderFullView()}
        </ScrollArea>
        
        {/* OVERLAYS */}
        {/* Set Indicator */}
        {!tempSong && currentSet && (
            <div className="fixed top-20 right-4 bg-black/40 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-medium border border-white/10 z-30 pointer-events-none fade-in animate-in">
                {currentSet.name}
            </div>
        )}

        {/* Next Song Indicator */}
        {nextSong && (
            <div className="fixed bottom-20 right-4 bg-black/60 backdrop-blur text-white px-4 py-2 rounded-lg text-sm font-medium border border-white/10 z-30 pointer-events-none max-w-[200px] truncate fade-in animate-in">
                <span className="text-white/60 text-xs uppercase mr-1">Next:</span> {nextSong.title}
            </div>
        )}

        {/* Floating Zoom Controls (Only in Full View) */}
        {viewMode === 'full' && (
            <div className="absolute bottom-20 right-4 flex flex-col gap-2 z-30 opacity-20 hover:opacity-100 transition-opacity">
                <Button variant="secondary" size="icon" className="h-10 w-10 shadow-lg rounded-full" onClick={() => handleZoom(2)}>
                    <ZoomIn className="h-5 w-5" />
                </Button>
                <Button variant="secondary" size="icon" className="h-10 w-10 shadow-lg rounded-full" onClick={() => handleZoom(-2)}>
                    <ZoomOut className="h-5 w-5" />
                </Button>
            </div>
        )}

        {tempSong && <div className="absolute top-4 right-4 bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg animate-pulse z-30">Ad-Hoc</div>}
        
        {/* Metronome Overlay */}
        {showMetronome && isMetronomeOpen && <div className="absolute bottom-0 left-0 right-0 z-10"><MetronomeControls variant="embedded" /></div>}
      </div>

      {/* --- Footer Controls --- */}
      <div className="h-16 border-t bg-card shrink-0 flex items-center px-4 gap-3 z-20 relative">
        {(isLeader || !isGigMode) ? (
            <>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-12 w-12 shrink-0"><Menu className="h-6 w-6" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56 mb-2">
                        {showMetronome && (
                            <DropdownMenuItem onClick={() => isMetronomeOpen ? closeMetronome() : openMetronome(activeSong?.tempo ? parseInt(activeSong.tempo) : 120)} className="py-3">
                                <Timer className="mr-2 h-4 w-4" /> Metronome
                            </DropdownMenuItem>
                        )}
                        
                        <DropdownMenuItem onClick={() => setIsSearchOpen(true)} className="py-3"><Search className="mr-2 h-4 w-4" /> Quick Find Song</DropdownMenuItem>
                        
                        {isGigMode && isLeader && skippedSongs.length > 0 && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setShowSkippedSongs(true)} className="py-3 text-orange-600">
                                    <History className="mr-2 h-4 w-4" /> Skipped Songs ({skippedSongs.length})
                                </DropdownMenuItem>
                            </>
                        )}

                        {isGigMode && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setShowParticipants(true)} className="py-3"><Users className="mr-2 h-4 w-4" /> Participants</DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

                <Button variant="outline" className="flex-1 h-12 text-lg" onClick={handlePrev} disabled={!tempSong && (currentSetIndex === 0 && currentSongIndex === 0)}>
                    <ChevronLeft className="mr-1 h-5 w-5" /> Prev
                </Button>
                <Button className={cn("flex-[1.5] h-12 text-lg", tempSong ? "bg-orange-600 hover:bg-orange-700" : "")} onClick={handleNext}>
                    {tempSong ? "Resume Set" : "Next"} <ChevronRight className="ml-1 h-5 w-5" />
                </Button>
            </>
        ) : (
            <>
                <Button variant="outline" className="flex-1 h-12" onClick={() => setShowParticipants(true)}>
                    <Users className="mr-2 h-4 w-4" /> In Session
                </Button>
                <Button variant="secondary" className="flex-1 h-12" onClick={() => setShowLeaderRequest(true)}>
                    <Crown className="mr-2 h-4 w-4" /> Become Leader
                </Button>
            </>
        )}
      </div>

      {/* --- Dialogs --- */}
      
      {/* Set Songs List Dialog */}
      <Dialog open={showSetSongsDialog} onOpenChange={setShowSetSongsDialog}>
          <DialogContent className="max-h-[80vh] flex flex-col p-0 gap-0">
              <DialogHeader className="px-6 py-4 border-b">
                  <DialogTitle>{currentSet?.name || "Set List"}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="flex-1">
                  <div className="divide-y">
                      {currentSet?.songs.map((item, idx) => {
                          const isActive = !tempSong && idx === currentSongIndex;
                          const isPast = !tempSong && idx < currentSongIndex;
                          return (
                              <div 
                                key={item.id} 
                                className={cn(
                                    "p-4 flex items-center gap-3",
                                    isActive ? "bg-primary/10 border-l-4 border-primary" : "hover:bg-accent",
                                    isPast ? "opacity-50" : ""
                                )}
                                onClick={() => {
                                    if(isLeader || !isGigMode) {
                                        setTempSong(null);
                                        setCurrentSongIndex(idx);
                                        if(isLeader) broadcastState(currentSetIndex, idx, null);
                                        setShowSetSongsDialog(false);
                                    }
                                }}
                              >
                                  <div className="w-6 text-center text-sm text-muted-foreground font-mono">{idx + 1}</div>
                                  <div className="flex-1">
                                      <div className={cn("font-medium", isActive && "text-primary font-bold")}>{item.song?.title}</div>
                                      <div className="text-xs text-muted-foreground">{item.song?.artist}</div>
                                  </div>
                                  {isActive && <Radio className="h-4 w-4 text-primary animate-pulse" />}
                              </div>
                          );
                      })}
                  </div>
              </ScrollArea>
              <DialogFooter className="p-2 border-t">
                  <Button variant="ghost" onClick={() => setShowSetSongsDialog(false)} className="w-full">Close</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* Search */}
      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogContent className="max-w-md h-[80vh] flex flex-col p-0 gap-0">
            <div className="p-4 border-b bg-muted/20">
                <Input placeholder="Search song..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus />
            </div>
            <ScrollArea className="flex-1">
                <div className="divide-y">
                    {filteredSongs.map(song => (
                        <div key={song.id} className="p-4 hover:bg-accent cursor-pointer" onClick={() => handleAdHocSelect(song)}>
                            <div className="font-medium">{song.title}</div>
                            <div className="text-sm text-muted-foreground">{song.artist}</div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Skipped Songs Dialog */}
      <Dialog open={showSkippedSongs} onOpenChange={setShowSkippedSongs}>
          <DialogContent className="max-w-md h-[60vh] flex flex-col p-0 gap-0">
              <DialogHeader className="px-6 py-4 border-b">
                  <DialogTitle>Skipped Songs</DialogTitle>
                  <DialogDescription>Select a song to play it now (as ad-hoc).</DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1">
                  <div className="divide-y">
                      {skippedSongs.map(song => (
                          <div key={song.id} className="p-4 hover:bg-accent cursor-pointer flex items-center justify-between group" onClick={() => handleRestoreSkippedSong(song)}>
                              <div>
                                  <div className="font-medium">{song.title}</div>
                                  <div className="text-sm text-muted-foreground">{song.artist}</div>
                              </div>
                              <Radio className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100" />
                          </div>
                      ))}
                  </div>
              </ScrollArea>
          </DialogContent>
      </Dialog>

      {/* Leader Exit Dialog */}
      <Dialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>End Performance Session?</DialogTitle>
                  <DialogDescription>
                      You are the leader of this session.
                  </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-2">
                  <div className="rounded-lg border p-4 bg-muted/20">
                      <h4 className="font-semibold mb-2">Option 1: Transfer Leadership</h4>
                      <p className="text-sm text-muted-foreground mb-3">Select another user to take over, then you will leave the session.</p>
                      
                      <div className="space-y-2 max-h-[150px] overflow-y-auto">
                          {participants.filter(p => p.user_id !== userId).map(p => (
                              <div key={p.id} className="flex items-center justify-between p-2 bg-background border rounded cursor-pointer hover:bg-accent" onClick={() => handleTransferAndLeave(p.user_id)}>
                                  <span className="text-sm">{p.profile?.first_name} {p.profile?.last_name}</span>
                                  <Crown className="h-3 w-3 text-muted-foreground" />
                              </div>
                          ))}
                          {participants.length <= 1 && (
                              <div className="text-sm italic text-muted-foreground">No other participants available.</div>
                          )}
                      </div>
                  </div>

                  <Button variant="destructive" className="w-full" onClick={handleEndSession}>
                      Option 2: End Session for Everyone
                  </Button>
              </div>
              
              <DialogFooter>
                  <Button variant="ghost" onClick={() => setShowExitConfirm(false)}>Cancel</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* Leadership Request from Follower */}
      <AlertDialog open={!!incomingRequest} onOpenChange={() => {}}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Leadership Request</AlertDialogTitle>
                  <AlertDialogDescription>
                      <span className="font-bold text-foreground">{incomingRequest?.userName}</span> wants to take control of the session.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => handleResolveRequest(false)}>Deny</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleResolveRequest(true)}>Approve</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showLeaderRequest} onOpenChange={setShowLeaderRequest}>
          <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Take Control?</AlertDialogTitle><AlertDialogDescription>This will send a request to the current leader. If they are inactive for 30s, you will be promoted automatically.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRequestLeadership}>Send Request</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showParticipants} onOpenChange={setShowParticipants}>
          <DialogContent>
              <DialogHeader><DialogTitle>In Session</DialogTitle></DialogHeader>
              <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                      {participants.map(p => {
                          const isPLeader = sessionData?.leader_id === p.user_id;
                          return (
                              <div key={p.id} className="flex items-center justify-between p-2 rounded hover:bg-accent">
                                  <div className="flex items-center gap-3">
                                      <div className="bg-primary/10 w-8 h-8 rounded-full flex items-center justify-center text-primary font-bold">
                                          {p.profile?.first_name?.[0] || "?"}
                                      </div>
                                      <div>
                                          <div className="font-medium">{p.profile?.first_name} {p.profile?.last_name}</div>
                                          <div className="text-xs text-muted-foreground">{p.profile?.position}</div>
                                      </div>
                                  </div>
                                  {isPLeader && <Badge>Leader</Badge>}
                              </div>
                          );
                      })}
                  </div>
              </ScrollArea>
          </DialogContent>
      </Dialog>
    </div>
  );
};

export default PerformanceMode;