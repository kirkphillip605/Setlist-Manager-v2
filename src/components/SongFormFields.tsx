import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UseFormRegister, FieldErrors } from "react-hook-form";
import { Song } from "@/types";

interface SongFormFieldsProps {
  register: UseFormRegister<Song>;
  errors: FieldErrors<Song>;
}

export const SongFormFields = ({ register, errors }: SongFormFieldsProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="Song Title"
            {...register("title", { required: "Title is required" })}
          />
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title.message}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="artist">Artist</Label>
          <Input
            id="artist"
            placeholder="Artist Name"
            {...register("artist", { required: "Artist is required" })}
          />
          {errors.artist && (
            <p className="text-sm text-destructive">{errors.artist.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="key">Key</Label>
          <Input
            id="key"
            placeholder="e.g. Am"
            {...register("key")}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="tempo">Tempo (BPM)</Label>
          <Input
            id="tempo"
            placeholder="e.g. 120"
            type="number"
            {...register("tempo")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="note">Note</Label>
          <Input
            id="note"
            placeholder="e.g. Capo 2"
            {...register("note")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="lyrics">Lyrics / Chords</Label>
        <Textarea
          id="lyrics"
          placeholder="Enter lyrics and chords here..."
          className="min-h-[200px] font-mono text-sm"
          {...register("lyrics")}
        />
      </div>
    </div>
  );
};