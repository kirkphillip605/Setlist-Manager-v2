import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { SongFormFields } from "@/components/SongFormFields";
import { getSongs, saveSong } from "@/lib/storage";
import { Song } from "@/types";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ChevronLeft, Save } from "lucide-react";

const SongEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Song>();

  useEffect(() => {
    if (id) {
      const songs = getSongs();
      const song = songs.find((s) => s.id === id);
      if (song) {
        reset(song);
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

  return (
    <AppLayout>
      <div className="space-y-6 pb-20">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {id ? "Edit Song" : "Add New Song"}
            </h1>
          </div>
        </div>

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
      </div>
    </AppLayout>
  );
};

export default SongEdit;