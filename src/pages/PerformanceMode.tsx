import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  addSkippedSong, removeSkippedSong, saveSong, updateSessionState, 
  endGigSession, requestLeadership, forceLeadership, resolveLeadershipRequest,
  leaveGigSession 
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
  ChevronLeft, ChevronRight, Search, Loader2, Music, Minimize2, Menu, Timer, Edit, Forward, Check, CloudOff, Users, Crown, Radio, LogOut, AlertTriangle
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

const PerformanceMode = () => {
  const { id } = useParams(); // Setlist ID
  const [searchParams] = useSearchParams();
  const gigId = searchParams.get('gigId');
  const isStandalone = searchParams.get('standalone') === 'true';
  const isGigMode = !!gigId && !isStandalone;
  const isOnline = useNetworkStatus();

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openMetronome, isOpen: isMetronomeOpen, bpm, closeMetronome } = useMetronome();
  
  // -- Session Hook --
  const { sessionData, participants, isLeader, loading: sessionLoading, userId } = useGigSession(isGigMode ? gigId : null);

  // Local State
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [tempSong, setTempSong] = useState<Song | null>(null);

  // -- Orphaned Session State --
  const [isOrphaned, setIsOrphaned] = useState(false);
  
  useEffect(() => {
      if (!isGigMode || isLeader || !sessionData) {
          setIsOrphaned(false);
          return;
      }

      const checkHeartbeat = () => {
          const last = new Date(sessionData.last_heartbeat).getTime();
          const now = Date.now();
          // 10 minutes timeout
          if (now - last > 10 * 60 * 1000) {
              setIsOrphaned(true);
          } else {
              setIsOrphaned(false);
          }
      };

      checkHeartbeat();
      const interval = setInterval(checkHeartbeat, 30000); // Check every 30s
      return () => clearInterval(interval);
  }, [sessionData, isGigMode, isLeader]);

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
      const baseSets = [...setlist.sets];
      if (!!gigId && skippedSongs.length > 0) {
          baseSets.push({
              id: 'skipped-set',
              name: 'Skipped Songs',
              position: 999,
              songs: skippedSongs.map((s, idx) => ({
                  id: `skip-${s.id}-${idx}`,
                  position: idx,
                  songId: s.id,
                  song: s
              }))
          });
      }
      return baseSets;
  }, [setlist, skippedSongs, gigId]);

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

  // -- Leader Update Logic --
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

  // -- UI States --
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showLeaderRequest, setShowLeaderRequest] = useState(false);
  const [incomingRequest, setIncomingRequest] = useState<any>(null);

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
      if(isGigMode && sessionData === null && sessionEndedInfo === null) {
          // If sessionData becomes null, it was deleted/ended.
          setSessionEndedInfo({
              endedBy: "Leader",
              at: new Date().toLocaleTimeString()
          });
      }
  }, [sessionData, isGigMode]);

  // -- Leadership Actions --
  const handleRequestLeadership = async () => {
      if (!sessionData || !userId) return;
      const now = new Date().getTime();
      const lastBeat = new Date(sessionData.last_heartbeat).getTime();
      const diff = (now - lastBeat) / 1000;

      // Force take over if stale (30s)
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
      // Remove self from participants after transferring
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
      navigate(isStandalone ? '/performance' : '/gigs');
  };

  // -- Render Helpers --
  const currentSet = sets[currentSetIndex];
  const activeSong = tempSong || currentSet?.songs[currentSongIndex]?.song;
  const filteredSongs = allSongs.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.artist.toLowerCase().includes(searchQuery.toLowerCase()));

  if (!setlist || (isGigMode && sessionLoading)) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  // Session Ended Screen
  if (isGigMode && sessionEndedInfo) {
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

  return (
    <div className="fixed inset-0 bg-background text-foreground flex flex-col z-50">
      {/* Orphaned Session Dialog */}
      <AlertDialog open={isOrphaned}>
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

      {/* --- Top Bar --- */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-card shadow-sm shrink-0 h-14 gap-2">
        <div className="flex-1 max-w-[200px] shrink-0 flex items-center gap-2">
          {!isOnline && <CloudOff className="h-4 w-4 text-muted-foreground" />}
          {isLeader || !isGigMode ? (
              <Select value={currentSetIndex.toString()} onValueChange={handleSetChange} disabled={!!tempSong}>
                <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Select Set" /></SelectTrigger>
                <SelectContent>
                  {sets.map((set, idx) => <SelectItem key={set.id} value={idx.toString()}>{set.name}</SelectItem>)}
                </SelectContent>
              </Select>
          ) : (
              <div className="bg-muted px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2">
                  <Radio className="h-3 w-3 text-green-500 animate-pulse" /> Following
              </div>
          )}
        </div>
        
        <div className="flex-1 text-center hidden md:flex items-center justify-center min-w-0 px-2">
            <span className="font-bold text-lg truncate">{activeSong?.title}</span>
            <span className="text-muted-foreground ml-2 text-sm truncate max-w-[150px]">{activeSong?.artist}</span>
        </div>

        <div className="flex items-center justify-end gap-2 flex-1 shrink-0">
            {isLeader && isGigMode && activeSong && !tempSong && isOnline && (
                 <Button variant="outline" size="sm" className="text-orange-600 border-orange-200 hover:bg-orange-50 h-9" onClick={() => addSkippedSong(gigId!, activeSong.id)}>
                     <Forward className="w-4 h-4 mr-2" /> Skip
                 </Button>
            )}
            
            {isGigMode && isLeader ? (
                <Button variant="ghost" size="sm" onClick={() => setShowExitConfirm(true)} className="h-9 text-destructive hover:text-destructive">
                    <span className="mr-2 hidden sm:inline">End Gig</span>
                    <LogOut className="h-4 w-4" />
                </Button>
            ) : (
                <Button variant="ghost" size="sm" onClick={handleFollowerExit} className="h-9">
                    Exit <Minimize2 className="h-4 w-4 ml-2" />
                </Button>
            )}
        </div>
      </div>

      {/* --- Main Content --- */}
      <div className="flex-1 overflow-hidden relative bg-background">
        <ScrollArea className="h-full w-full">
          <div className="p-4 md:p-8 max-w-4xl mx-auto min-h-full pb-32">
            {activeSong ? (
              <div className="space-y-6">
                <div className="md:hidden text-center border-b pb-4 mb-4">
                    <h2 className="text-2xl font-bold leading-tight">{activeSong.title}</h2>
                    <p className="text-muted-foreground">{activeSong.artist}</p>
                </div>
                
                <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-6">
                    {activeSong.key && <Badge variant="secondary" className="text-sm">Key: {activeSong.key}</Badge>}
                    {activeSong.tempo && <Badge variant="secondary" className="text-sm">{activeSong.tempo} BPM</Badge>}
                    {activeSong.note && <div className="bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 px-3 py-1 rounded text-sm">{activeSong.note}</div>}
                </div>

                <div className="whitespace-pre-wrap font-mono text-lg md:text-xl leading-relaxed">
                  {activeSong.lyrics || <span className="text-muted-foreground italic">No lyrics available.</span>}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
                <Music className="h-16 w-16 mb-4 opacity-20" />
                <p>{isLeader || isStandalone ? "Select a song to begin" : "Waiting for leader..."}</p>
              </div>
            )}
          </div>
        </ScrollArea>
        {tempSong && <div className="absolute top-4 right-4 bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg animate-pulse">Ad-Hoc</div>}
        {(!isGigMode || isStandalone) && isMetronomeOpen && <div className="absolute bottom-0 left-0 right-0 z-10"><MetronomeControls variant="embedded" /></div>}
      </div>

      {/* --- Footer Controls --- */}
      <div className="h-16 border-t bg-card shrink-0 flex items-center px-4 gap-3 z-20 relative">
        {(isLeader || !isGigMode) ? (
            <>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-12 w-12 shrink-0"><Menu className="h-5 w-5" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48 mb-2">
                        <DropdownMenuItem onClick={() => isMetronomeOpen ? closeMetronome() : openMetronome(activeSong?.tempo ? parseInt(activeSong.tempo) : 120)} className="py-3">
                            <Timer className="mr-2 h-4 w-4" /> Metronome
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsSearchOpen(true)} className="py-3"><Search className="mr-2 h-4 w-4" /> Quick Find</DropdownMenuItem>
                        {isGigMode && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setShowParticipants(true)}><Users className="mr-2 h-4 w-4" /> Participants</DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

                <Button variant="outline" className="flex-1 h-12 text-base" onClick={handlePrev} disabled={!tempSong && (currentSetIndex === 0 && currentSongIndex === 0)}>
                    <ChevronLeft className="mr-2 h-5 w-5" /> Prev
                </Button>
                <Button className={cn("flex-[1.5] h-12 text-base", tempSong ? "bg-orange-600 hover:bg-orange-700" : "")} onClick={handleNext}>
                    {tempSong ? "Resume Set" : "Next Song"} <ChevronRight className="ml-2 h-5 w-5" />
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