import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Smartphone, X } from "lucide-react";
import { storageAdapter } from "@/lib/storageAdapter";

interface MobileAppSuggestionProps {
  onDismiss: () => void;
}

export const MobileAppSuggestion = ({ onDismiss }: MobileAppSuggestionProps) => {
  const [platform, setPlatform] = useState<'ios' | 'android' | null>(null);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    const ua = navigator.userAgent;
    if (/android/i.test(ua)) {
      setPlatform('android');
    } else if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) {
      setPlatform('ios');
    }
  }, []);

  if (!platform) return null;

  const storeUrl = platform === 'ios' 
    ? import.meta.env.VITE_APPLE_APP_STORE_URL 
    : import.meta.env.VITE_GOOGLE_PLAY_STORE_URL;

  const storeImage = platform === 'ios'
    ? "/app-store.png"
    : "/play-store.png";

  if (!storeUrl) return null; // Don't show if URL isn't configured

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <Card className="w-full max-w-sm shadow-2xl border-primary/20 relative overflow-hidden">
        {/* Background Blob for style */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        
        <CardHeader className="text-center pb-2 relative">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
             <Smartphone className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Get the App</CardTitle>
          <CardDescription className="text-base">
            For the best performance and offline capabilities, use the Setlist Manager Pro app.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 flex flex-col items-center pt-4">
          
          <a 
            href={storeUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="transition-transform hover:scale-105 active:scale-95"
          >
            <img 
              src={storeImage} 
              alt={platform === 'ios' ? "Download on the App Store" : "Get it on Google Play"} 
              className="h-14 w-auto object-contain"
            />
          </a>

          <div className="relative w-full py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>

          <Button 
            variant="ghost" 
            className="w-full text-muted-foreground hover:text-foreground" 
            onClick={onDismiss}
          >
            Continue to Web App
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};