import { AppStatus } from "@/types/system";
import { AlertTriangle, Clock, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Capacitor } from "@capacitor/core";
import { format } from "date-fns";

interface SystemStatusScreenProps {
  status: AppStatus | null;
  mode: 'maintenance' | 'update';
}

export const SystemStatusScreen = ({ status, mode }: SystemStatusScreenProps) => {
  const isAndroid = Capacitor.getPlatform() === 'android';
  const isIOS = Capacitor.getPlatform() === 'ios';

  const handleUpdateClick = () => {
    if (isAndroid && status?.update_url_android) {
        window.open(status.update_url_android, '_system');
    } else if (isIOS && status?.update_url_ios) {
        window.open(status.update_url_ios, '_system');
    } else {
        // Fallback or Web reload
        window.location.reload();
    }
  };

  if (mode === 'maintenance') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 animate-in fade-in duration-500">
        <div className="w-full max-w-md space-y-6 text-center">
            <div className="mx-auto w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-amber-500" />
            </div>
            
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">System Maintenance</h1>
                <p className="text-muted-foreground text-lg">
                    {status?.maintenance_message || "We are performing scheduled maintenance to improve your experience."}
                </p>
            </div>

            {status?.maintenance_expected_end_at && (
                <Card className="bg-muted/50 border-muted">
                    <CardContent className="flex items-center justify-center gap-3 py-4">
                        <Clock className="w-5 h-5 text-muted-foreground" />
                        <div className="text-sm">
                            <span className="text-muted-foreground block text-xs uppercase font-bold tracking-wider">Expected Back Online</span>
                            <span className="font-medium">
                                {format(new Date(status.maintenance_expected_end_at), "MMM d, h:mm a")}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            )}

            <p className="text-xs text-muted-foreground pt-8">
                The application will automatically reload once maintenance is complete.
            </p>
        </div>
      </div>
    );
  }

  // Update Mode
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 animate-in fade-in duration-500">
        <Card className="w-full max-w-md shadow-2xl border-primary/20">
            <CardHeader className="text-center pb-2">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <Download className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Update Required</CardTitle>
                <CardDescription>
                    A new version of Setlist Manager Pro is available.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 text-center">
                <p className="text-muted-foreground">
                    To ensure the best performance and access to new features, please update the app to continue.
                </p>
                
                <div className="bg-muted/30 rounded-lg p-3 text-sm font-mono text-muted-foreground">
                    Required Version: {status?.min_version_name || "Latest"}
                </div>

                <Button className="w-full h-12 text-base" onClick={handleUpdateClick}>
                    {isAndroid || isIOS ? "Go to Store" : "Refresh App"}
                </Button>
            </CardContent>
        </Card>
    </div>
  );
};