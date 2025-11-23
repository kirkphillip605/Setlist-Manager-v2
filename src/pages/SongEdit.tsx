import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { SongFormFields } from "@/components/SongFormFields";
import { getSongs, saveSong } from "@/lib/storage";
import { searchMusic, fetchLyrics } from "@/lib/musicApi";
import { Song } from "@/types";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ChevronLeft, Save, Search, Music, Loader2, ArrowRight } from "lucide-react";

const SongEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'search' | 'edit'>(id ? 'edit' : 'search');
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<Song>();

  useEffect(() => {
    if (id) {
      const songs = getSongs();
      const song = songs.find((s) => s.id === id);
      if (song) {
        reset(song);
        setMode('edit');
      }
    }
  }, [id, reset]);

  const onSubmit = (data: Song) => {
    const songToSave = {
      ...data,
      id: id || crypto.randomUUID(),
    };
    saveSong(songToSave);
    toast.success(id ? "Song updated!" : "Song added!");
    navigate("/songs");
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

  const selectSong = async (result: any) => {
    setIsSearching(true);
    try {
      const lyrics = await fetchLyrics(result.artistName, result.trackName);
      
      setValue("title", result.trackName);
      setValue("artist", result.artistName);
      if (lyrics) {
        setValue("lyrics", lyrics);
        toast.success("Lyrics found and auto-filled!");
      } else {
        toast.info("Could not find lyrics automatically.");
      }
      
      // Note: Public APIs for Key/Tempo are rare/paid. 
      // Leaving these blank for user to fill.
      setValue("key", "");
      setValue("tempo", "");
      
      setMode('edit');
    } catch (error) {
      console.error(error);
      setMode('edit');
    } finally {
      setIsSearching(false);
    }
  };

  const renderSearch = () => (
    <div className="space-y-6 max-w-2xl mx-auto">
       <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Add New Song</h2>
        <p className="text-muted-foreground">Search to auto-fill details or skip to manual entry.</p>
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
            <Button type="submit" disabled={isSearching}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {searchResults.map((result, index) => (
          <Card 
            key={index} 
            className="hover:bg-accent cursor-pointer transition-colors"
            onClick={() => selectSong(result)}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-full">
                  <Music className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{result.trackName}</p>
                  <p className="text-sm text-muted-foreground">{result.artistName}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm">Select</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center pt-4">
        <Button variant="link" onClick={() => setMode('edit')}>
          Skip to manual entry <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
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
            <SongFormFields register={register} errors={errors} />
            
            <div className="flex gap-4">
              <Button type="submit" className="w-full sm:w-auto">
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