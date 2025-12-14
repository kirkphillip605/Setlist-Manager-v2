import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldAlert, Loader2, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PendingApproval = () => {
  const { profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Poll every 30 seconds
    const interval = setInterval(() => {
        refreshProfile();
    }, 30000);

    return () => clearInterval(interval);
  }, [refreshProfile]);

  useEffect(() => {
      // If profile becomes approved, redirect
      if (profile?.is_approved) {
          navigate("/");
      }
  }, [profile, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto bg-amber-100 p-4 rounded-full mb-4">
             <ShieldAlert className="h-10 w-10 text-amber-600" />
          </div>
          <CardTitle>Approval Pending</CardTitle>
          <CardDescription>
            Your account has been created successfully, but requires Admin approval before you can access the application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
           <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking status...
           </div>
           
           <p className="text-sm text-muted-foreground">
             We will automatically check your status periodically. You can also contact an administrator to expedite this process.
           </p>

           <Button variant="outline" className="w-full" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
           </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApproval;