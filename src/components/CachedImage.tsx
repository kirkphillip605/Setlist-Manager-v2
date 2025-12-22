import { useState, useEffect } from 'react';
import { get, set } from 'idb-keyval';
import { cn } from "@/lib/utils";

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallbackSrc?: string;
  cacheKey?: string;
}

export const CachedImage = ({ src, fallbackSrc, cacheKey, className, alt, ...props }: CachedImageProps) => {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;
    const key = cacheKey || src;

    const load = async () => {
      setHasError(false);
      try {
        // 1. Check offline cache
        const cachedBlob = await get(key);
        if (cachedBlob && active) {
           const url = URL.createObjectURL(cachedBlob);
           setImgSrc(url);
           // We have it cached, but let's try to update it in background if we are online?
           // For now, let's trust the cache to avoid flickering/bandwidth.
           return; 
        }

        // 2. Not in cache, fetch it
        const response = await fetch(src);
        if (!response.ok) throw new Error('Network response was not ok');
        const blob = await response.blob();
        
        if (active) {
            const url = URL.createObjectURL(blob);
            setImgSrc(url);
            // Save to cache
            try {
                await set(key, blob);
            } catch (err) {
                console.warn("Failed to cache image", err);
            }
        }
      } catch (e) {
        console.warn("Image load failed", src, e);
        if (active) setHasError(true);
      }
    };

    if (src) {
        load();
    } else {
        setHasError(true);
    }

    return () => { active = false; };
  }, [src, cacheKey]);

  if (hasError || !imgSrc) {
      if (fallbackSrc) return <img src={fallbackSrc} className={className} alt={alt} {...props} />;
      return <div className={cn("bg-muted flex items-center justify-center", className)} title={alt} />;
  }

  return <img src={imgSrc} className={className} alt={alt} {...props} />;
};