import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const SetInitialPassword = () => {
  const { signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
        toast.error("Passwords do not match");
        return;
    }
    if (password.length < 6) {
        toast.error("Password must be at least 6 characters");
        return;
    }

    setLoading(true);
    // 1. Update Auth Password
    const { error: authError } = await supabase.auth.updateUser({ password: password });
    
    if (authError) {
        toast.error(authError.message);
        setLoading(false);
        return;
    }

    // 2. Update Profile Flag
    const { error: dbError } = await supabase
        .from('profiles')
        .update({ has_password: true })
        .eq('id', (await supabase.auth.getUser()).data.user?.id);

    if (dbError) {
        toast.error("Failed to update profile status");
    } else {
        toast.success("Password set successfully!");
        await refreshProfile();
        navigate("/");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
            <div className="mx-auto bg-primary/10 p-4 rounded-full mb-4">
                 <Lock className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-center">Create Password</CardTitle>
            <CardDescription className="text-center">
                For security, please create a password for your account. This allows you to login if Google services are unavailable.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label>New Password</Label>
                    <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                    <Label>Confirm Password</Label>
                    <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
                </div>
                
                <div className="space-y-2 pt-2">
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Set Password
                    </Button>
                    <Button type="button" variant="ghost" className="w-full" onClick={signOut}>
                        Sign Out
                    </Button>
                </div>
            </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SetInitialPassword;