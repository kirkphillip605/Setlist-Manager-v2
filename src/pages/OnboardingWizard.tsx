import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, User, Lock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const POSITIONS = [
  "Lead Vocals", "Lead Guitar", "Rhythm Guitar", "Bass Guitar", 
  "Drums", "Keyboard/Piano", "Sound Engineer", "Lighting", "Other"
];

const OnboardingWizard = () => {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  
  // Steps: 1 = Profile, 2 = Password (if needed)
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [position, setPosition] = useState("");
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Pre-fill logic
  useEffect(() => {
    if (profile) {
        setFirstName(profile.first_name || "");
        setLastName(profile.last_name || "");
        setPosition(profile.position || "");
    }
    
    // If profile is empty, try to get from Google metadata
    if (session?.user?.user_metadata) {
        const meta = session.user.user_metadata;
        if (!profile?.first_name && meta.full_name) {
            const parts = meta.full_name.split(' ');
            if (parts.length >= 1) setFirstName(parts[0]);
            if (parts.length >= 2) setLastName(parts.slice(1).join(' '));
        } else {
            if (!profile?.first_name && meta.given_name) setFirstName(meta.given_name);
            if (!profile?.last_name && meta.family_name) setLastName(meta.family_name);
        }
    }
  }, [profile, session]);

  const needsPassword = profile && profile.has_password === false;

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
        .from('profiles')
        .update({
            first_name: firstName,
            last_name: lastName,
            position: position,
            updated_at: new Date().toISOString()
        })
        .eq('id', session?.user?.id);

    if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
    }

    // Refresh context
    await refreshProfile();
    setLoading(false);

    if (needsPassword) {
        setStep(2);
    } else {
        navigate("/");
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
        toast.error("Passwords do not match");
        return;
    }
    if (password.length < 6) {
        toast.error("Password must be at least 6 characters");
        return;
    }

    setLoading(true);
    
    // 1. Set Auth Password
    const { error: authError } = await supabase.auth.updateUser({ password });
    if (authError) {
        toast.error(authError.message);
        setLoading(false);
        return;
    }

    // 2. Update DB Flag
    const { error: dbError } = await supabase
        .from('profiles')
        .update({ has_password: true })
        .eq('id', session?.user?.id);

    if (dbError) {
        toast.error("Failed to update profile status");
    } else {
        toast.success("Setup complete!");
        await refreshProfile();
        navigate("/");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border shadow-lg">
        
        {step === 1 && (
            <form onSubmit={handleProfileSubmit}>
                <CardHeader>
                    <div className="mx-auto bg-primary/10 p-4 rounded-full mb-4">
                        <User className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-center">Complete Your Profile</CardTitle>
                    <CardDescription className="text-center">
                        Tell us a bit about yourself to get started.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="fname">First Name</Label>
                            <Input 
                                id="fname" 
                                value={firstName} 
                                onChange={e => setFirstName(e.target.value)} 
                                required 
                                autoComplete="given-name"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="lname">Last Name</Label>
                            <Input 
                                id="lname" 
                                value={lastName} 
                                onChange={e => setLastName(e.target.value)} 
                                required 
                                autoComplete="family-name"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="pos">Band Position</Label>
                        <Select value={position} onValueChange={setPosition} required>
                            <SelectTrigger>
                                <SelectValue placeholder="Select your role" />
                            </SelectTrigger>
                            <SelectContent>
                                {POSITIONS.map(p => (
                                    <SelectItem key={p} value={p}>{p}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                    <Button type="submit" className="w-full" disabled={loading || !firstName || !lastName || !position}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {needsPassword ? "Next: Set Password" : "Continue to App"}
                    </Button>
                    <Button type="button" variant="ghost" className="w-full text-xs" onClick={() => signOut()}>
                        Cancel & Sign Out
                    </Button>
                </CardFooter>
            </form>
        )}

        {step === 2 && (
            <form onSubmit={handlePasswordSubmit}>
                <CardHeader>
                    <div className="mx-auto bg-primary/10 p-4 rounded-full mb-4">
                        <Lock className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-center">Create Password</CardTitle>
                    <CardDescription className="text-center">
                        For security, please create a password to access your account independently of Google.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="pwd">New Password</Label>
                        <Input 
                            id="pwd" 
                            type="password" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            required 
                            autoComplete="new-password"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="cpwd">Confirm Password</Label>
                        <Input 
                            id="cpwd" 
                            type="password" 
                            value={confirmPassword} 
                            onChange={e => setConfirmPassword(e.target.value)} 
                            required 
                            autoComplete="new-password"
                        />
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Complete Setup
                    </Button>
                </CardFooter>
            </form>
        )}

      </Card>
    </div>
  );
};

export default OnboardingWizard;