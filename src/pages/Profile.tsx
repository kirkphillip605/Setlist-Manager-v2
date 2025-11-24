import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, User, Save, LogOut, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";

const POSITIONS = [
  "Lead Vocals", "Backing Vocals", "Lead Guitar", "Rhythm Guitar", "Bass Guitar", 
  "Drums", "Keyboard/Piano", "Saxophone", "Trumpet", "Percussion", 
  "Sound Engineer", "Lighting", "Manager", "Other"
];

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  
  // Profile State
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    position: "",
    avatar_url: ""
  });

  // Password Change State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // OTP State
  const [isOtpOpen, setIsOtpOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpAction, setOtpAction] = useState<"profile" | "password" | null>(null);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email || "");

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
      } else if (data) {
        setProfile({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          position: data.position || "",
          avatar_url: data.avatar_url || ""
        });
      }
      setLoading(false);
    };

    fetchProfile();
  }, []);

  // -- Action Handlers --

  const initiateSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setOtpAction("profile");
    sendOtp();
  };

  const initiateChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setOtpAction("password");
    sendOtp();
  };

  const sendOtp = async () => {
    setSaving(true);
    // Send OTP to user's email
    const { error } = await supabase.auth.signInWithOtp({
      email: userEmail,
      options: { shouldCreateUser: false } // ensure we don't create new users
    });

    if (error) {
      toast.error("Failed to send verification code: " + error.message);
      setSaving(false);
      setOtpAction(null);
    } else {
      setIsOtpOpen(true);
      toast.success("Verification code sent to your email");
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) return;
    setVerifyingOtp(true);

    // Verify the OTP
    const { data, error } = await supabase.auth.verifyOtp({
      email: userEmail,
      token: otpCode,
      type: 'email'
    });

    if (error) {
      toast.error("Invalid code. Please try again.");
      setVerifyingOtp(false);
      return;
    }

    // If verification successful, proceed with action
    if (otpAction === "profile") {
        await saveProfileData();
    } else if (otpAction === "password") {
        await savePasswordData();
    }

    setIsOtpOpen(false);
    setOtpCode("");
    setVerifyingOtp(false);
    setSaving(false);
  };

  const saveProfileData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: profile.first_name,
        last_name: profile.last_name,
        position: profile.position,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      toast.error("Failed to update profile: " + error.message);
    } else {
      toast.success("Profile updated successfully");
    }
  };

  const savePasswordData = async () => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error("Failed to update password: " + error.message);
    } else {
      toast.success("Password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error(error.message);
  };

  if (loading) return (
    <AppLayout>
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl mx-auto pb-20">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Profile & Security</h1>
          <p className="text-muted-foreground">Manage your personal information and account security.</p>
        </div>

        {/* Profile Info Form */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Details</CardTitle>
            <CardDescription>Update your public band profile.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={initiateSaveProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={profile.first_name}
                    onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={profile.last_name}
                    onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">Band Position</Label>
                <Select 
                  value={profile.position} 
                  onValueChange={(val) => setProfile({ ...profile, position: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map((pos) => (
                      <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving && otpAction === "profile" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Password Change Form */}
        <Card>
          <CardHeader>
             <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-orange-500" />
                Security
             </CardTitle>
             <CardDescription>Change your password. Requires email verification.</CardDescription>
          </CardHeader>
          <CardContent>
             <form onSubmit={initiateChangePassword} className="space-y-4">
                <div className="space-y-2">
                   <Label htmlFor="newPass">New Password</Label>
                   <Input 
                      id="newPass" 
                      type="password" 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                   />
                </div>
                <div className="space-y-2">
                   <Label htmlFor="confirmPass">Verify New Password</Label>
                   <Input 
                      id="confirmPass" 
                      type="password" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                   />
                </div>
                <div className="flex justify-end">
                    <Button type="submit" variant="secondary" disabled={saving || !newPassword}>
                         {saving && otpAction === "password" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                         Update Password
                    </Button>
                </div>
             </form>
          </CardContent>
        </Card>

        <div className="pt-4 flex justify-center">
            <Button variant="ghost" onClick={handleSignOut} className="text-destructive hover:bg-destructive/10">
                <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
        </div>

        {/* OTP Dialog */}
        <Dialog open={isOtpOpen} onOpenChange={(open) => { if(!verifyingOtp) setIsOtpOpen(open); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Security Verification</DialogTitle>
                    <DialogDescription>
                        A one-time passcode was sent to <b>{userEmail}</b>. Please enter it below to confirm your changes.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex items-center justify-center py-4">
                    <InputOTP 
                        maxLength={6} 
                        value={otpCode}
                        onChange={(val) => setOtpCode(val)}
                        disabled={verifyingOtp}
                    >
                        <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                        </InputOTPGroup>
                        <div className="w-4" />
                        <InputOTPGroup>
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                        </InputOTPGroup>
                    </InputOTP>
                </div>
                <DialogFooter className="flex flex-col sm:flex-row gap-2">
                     <Button variant="ghost" onClick={() => setIsOtpOpen(false)} disabled={verifyingOtp}>Cancel</Button>
                     <Button onClick={handleVerifyOtp} disabled={otpCode.length !== 6 || verifyingOtp}>
                        {verifyingOtp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Verify & Save
                     </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Profile;