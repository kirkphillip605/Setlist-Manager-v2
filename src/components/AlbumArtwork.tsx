import { cn } from "@/lib/utils";
import { Music } from "lucide-react";
import { CachedImage } from "@/components/CachedImage";

interface AlbumArtworkProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  fallbackSrc?: string;
  containerClassName?: string;
}

export const AlbumArtwork = ({ 
  src, 
  alt, 
  className, 
  containerClassName,
  fallbackSrc = "/no-album-artwork.png", 
  ...props 
}: AlbumArtworkProps) => {
  
  return (
    <div className={cn("relative overflow-hidden bg-secondary flex items-center justify-center", containerClassName || className)} {...props}>
        {src ? (
            <CachedImage
                src={src}
                alt={alt || "Album Artwork"}
                fallbackSrc={fallbackSrc}
                className={cn("absolute inset-0 w-full h-full object-cover", className)}
            />
        ) : (
            <div className="w-full h-full flex items-center justify-center bg-secondary text-muted-foreground/20">
                <Music className="w-1/3 h-1/3" />
            </div>
        )}
    </div>
  );
};