import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { SongFormFields } from "@/components/SongFormFields";
import { getSong, saveSong } from "@/lib/api";
import { searchMusic, fetchLyrics, fetchAudioFeatures, MusicResult } from "@/lib/musicApi";
import { Song } from "@/types";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Save, Search, Music, Loader2, ArrowRight } from "lucide-react";

const SongEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'search' | 'edit'>(id ? 'edit' : 'search');
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchResults, setSearchResults] = useState<MusicResult[]>([]);
  
  // New state to hold extra data not in the main form visible fields if needed, 
  // or just use setValue if we add hidden fields to form (which is cleaner).
  // Actually, we can just use the form's setValue if we add the fields to the generic Song type,
  // even if we don't render inputs for them (react-hook-form handles this).

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<Song>();

  // Watch cover_url to show preview
  const coverUrl = watch("cover_url");

  // Fetch song if editing
  const { data: song, isLoading: isSongLoading } = useQuery({
    queryKey: ['song', id],
    queryFn: () => getSong(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (song) {
      reset(song);
      setMode('edit');
    }
  }, [song, reset]);

  const saveMutation = useMutation({
    mutationFn: saveSong,
    onSuccess: () => {
      toast.success(id ? "Song updated!" : "Song added!");
      queryClient.invalidateQueries({ queryKey: ['songs'] });
      navigate("/songs");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to save song");
    }
  });

  const onSubmit = (data: Song) => {
    saveMutation.mutate(data);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await searchMusic(searchQuery);
      setSearchResults(results);
      if (results.length === 0) {
        toast.info("No matches found. Try a different search.");
      }
    } catch (error) {
      toast.error("Failed to search songs");
    } finally {
      setIsSearching(false);
    }
  };

  const selectSong = async (result: MusicResult) => {
    setIsProcessing(true);
    const toastId = toast.loading("Fetching song details (Key, Tempo, Lyrics)...");
    
    try {
      // 1. Set Basic Info & Metadata
      setValue("title", result.title);
      setValue("artist", result.artist);
      if (result.coverUrl) setValue("cover_url", result.coverUrl);
      if (result.spotifyUrl) setValue("spotify_url", result.spotifyUrl);

      // 2. Parallel Fetch: Lyrics and Audio Features
      const [lyrics, features] = await Promise.all([
        fetchLyrics(result.artist, result.title),
        fetchAudioFeatures(result.id)
      ]);

      // 3. Set Lyrics
      if (lyrics) {
        setValue("lyrics", lyrics);
      } else {
        setValue("lyrics", "");
      }

      // 4. Set Features
      if (features.key) setValue("key", features.key);
      if (features.tempo) setValue("tempo", features.tempo);

      // 5. Feedback
      if (lyrics && features.key) {
        toast.success("Lyrics and Audio features found!", { id: toastId });
      } else if (lyrics) {
        toast.success("Lyrics found!", { id: toastId });
      } else if (features.key) {
        toast.success("Audio features found! (Lyrics missing)", { id: toastId });
      } else {
        toast.info("Metadata set (Lyrics/Features not found)", { id: toastId });
      }

      setMode('edit');
    } catch (error) {
      console.error("Error in selectSong:", error);
      toast.error("Error fetching details", { id: toastId });
      setMode('edit'); 
    } finally {
      setIsProcessing(false);
    }
  };

  const renderSearch = () => (
    <div className="space-y-6 max-w-2xl mx-auto">
       <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Add New Song</h2>
        <p className="text-muted-foreground">Search Spotify to auto-fill details or skip to manual entry.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              placeholder="Search by Artist or Title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={isSearching || isProcessing}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {searchResults.map((result) => (
          <Card 
            key={result.id} 
            className={`hover:bg-accent cursor-pointer transition-colors ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={() => selectSong(result)}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {result.coverUrl ? (
                  <img src={result.coverUrl} alt="Album Art" className="w-12 h-12 rounded object-cover shadow-sm" />
                ) : (
                  <div className="bg-[#1DB954]/10 w-12 h-12 flex items-center justify-center rounded-full">
                    <Music className="h-6 w-6 text-[#1DB954]" />
                  </div>
                )}
                <div>
                  <p className="font-medium">{result.title}</p>
                  <p className="text-sm text-muted-foreground">{result.artist}</p>
                  {result.album && (
                    <p className="text-xs text-muted-foreground">{result.album}</p>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" disabled={isProcessing}>
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Select"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center pt-4">
        <Button variant="link" onClick={() => setMode('edit')} disabled={isProcessing}>
          Skip to manual entry <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  if (isSongLoading) return (
    <AppLayout>
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="space-y-6 pb-20">
        {mode === 'edit' && (
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => {
              if (!id) setMode('search'); 
              else navigate(-1);
            }}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {id ? "Edit Song" : "Song Details"}
              </h1>
            </div>
          </div>
        )}

        {mode === 'search' ? (
          renderSearch()
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-2xl">
            {/* Hidden fields for extra data */}
            <input type="hidden" {...register("cover_url")} />
            <input type="hidden" {...register("spotify_url")} />

            {/* Album Art Preview in Edit Mode */}
            {coverUrl && (
              <div className="flex items-center gap-4 p-4 border rounded-lg bg-secondary/10">
                <img src={coverUrl} alt="Album Art" className="w-16 h-16 rounded shadow-sm object-cover" />
                <div>
                  <p className="text-sm font-medium">Album Artwork</p>
                  <p className="text-xs text-muted-foreground">Automatically imported from Spotify</p>
                </div>
              </div>
            )}

            <SongFormFields register={register} errors={errors} control={control} />
            
            <div className="flex gap-4">
              <Button type="submit" className="w-full sm:w-auto" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Song
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </AppLayout>
  );
};

export default SongEdit;