import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UseFormRegister, FieldErrors, Control, Controller } from "react-hook-form";
import { Song } from "@/types";
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

interface SongFormFieldsProps {
  register: UseFormRegister<Song>;
  errors: FieldErrors<Song>;
  control: Control<Song>;
}

// Keys mapped to match musicApi.ts for guitar friendliness
const KEYS = [
  // Major
  "C Major", "Db Major", "D Major", "Eb Major", "E Major", "F Major", 
  "F# Major", "G Major", "Ab Major", "A Major", "Bb Major", "B Major",
  // Minor
  "C Minor", "C# Minor", "D Minor", "D# Minor", "E Minor", "F Minor", 
  "F# Minor", "G Minor", "G# Minor", "A Minor", "Bb Minor", "B Minor"
];

export const SongFormFields = ({ register, errors, control }: SongFormFieldsProps) => {
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="key">Key</Label>
          <Input
            id="key"
            list="keys-list"
            placeholder="e.g. A Major"
            {...register("key")}
          />
          <datalist id="keys-list">
            {KEYS.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="tempo">Tempo (BPM)</Label>
          <Input
            id="tempo"
            placeholder="120"
            type="number"
            {...register("tempo")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="duration">Duration</Label>
          <Input
            id="duration"
            placeholder="3:45"
            {...register("duration")}
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
        <Controller
          name="lyrics"
          control={control}
          render={({ field }) => (
            <ReactQuill 
              theme="snow" 
              value={field.value || ''} 
              onChange={field.onChange}
              className="bg-background"
              modules={{
                toolbar: [
                  [{ 'header': [1, 2, false] }],
                  ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                  [{'list': 'ordered'}, {'list': 'bullet'}],
                  ['link', 'clean'],
                  [{ 'color': [] }, { 'background': [] }],
                  [{ 'align': [] }]
                ],
              }}
            />
          )}
        />
      </div>
    </div>
  );
};