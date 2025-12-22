import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Music } from "lucide-react";

interface AlbumArtworkProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string | null;
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
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    if (!src) {
      setStatus('error');
    } else {
      setStatus('loading');
    }
  }, [src]);

  return (
    <div className={cn("relative overflow-hidden bg-secondary", containerClassName || className)}>
        {/* Placeholder / Fallback */}
        {/* We show this if: 
            1. We are loading
            2. We had an error
            3. No source was provided
        */}
        {(status === 'loading' || status === 'error' || !src) && (
            <div className="w-full h-full flex items-center justify-center bg-secondary">
                <img 
                    src={fallbackSrc} 
                    alt="No Artwork" 
                    className="w-full h-full object-cover opacity-80" 
                />
            </div>
        )}
        
        {/* Actual Image */}
        {src && (
            <img
                src={src}
                alt={alt}
                className={cn(
                    "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
                    status === 'loaded' ? "opacity-100" : "opacity-0",
                    className // Pass className to the img for specific styling if needed, though container handles size usually
                )}
                onLoad={() => setStatus('loaded')}
                onError={() => setStatus('error')}
                {...props}
            />
        )}
    </div>
  );
};