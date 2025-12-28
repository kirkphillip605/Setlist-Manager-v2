import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, User, Save, LogOut, ShieldAlert, Cloud, RefreshCw, AlertTriangle, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSyncStatus } from "@/hooks/useSyncedData";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { LoadingDialog } from "@/components/LoadingDialog";

const POSITIONS = [
  "Lead Vocals", "Lead Guitar", "Rhythm Guitar", "Bass Guitar", 
  "Drums", "Keyboard/Piano", "Sound Engineer", "Lighting", "Other"
];

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const { session, signOut, refreshProfile } = useAuth();
  
  const { lastSyncedAt, isSyncing, refreshAll } = useSyncStatus();
  const isOnline = useNetworkStatus();

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
  const [otpAction, setOtpAction] = useState<"password" | "delete" | null>(null);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Delete State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!session?.user) return;
      setUserEmail(session.user.email || "");

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
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
  }, [session]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: profile.first_name,
        last_name: profile.last_name,
        position: profile.position,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.user.id);

    if (error) {
      toast.error("Failed to update profile: " + error.message);
    } else {
      toast.success("Profile updated successfully");
      refreshProfile();
    }
    setSaving(false);
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

  const initiateDeleteAccount = () => {
      setIsDeleteOpen(false);
      setOtpAction("delete");
      sendOtp();
  };

  const sendOtp = async () => {
    setSaving(true);
    // Send OTP to user's email
    const { error } = await supabase.auth.signInWithOtp({
      email: userEmail,
      options: { shouldCreateUser: false } 
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

    if (otpAction === "password") {
        await savePasswordData();
    } else if (otpAction === "delete") {
        await performSoftDelete();
    }

    setIsOtpOpen(false);
    setOtpCode("");
    setVerifyingOtp(false);
    setSaving(false);
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

  const performSoftDelete = async () => {
      if (!session?.user) return;
      
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('id', session.user.id);
      
      if (error) {
          toast.error("Failed to deactivate account: " + error.message);
      } else {
          toast.success("Account deactivated.");
          await supabase.auth.signOut();
          navigate("/login");
      }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
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
      <LoadingDialog open={saving || verifyingOtp} />
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
            <form onSubmit={handleSaveProfile} className="space-y-4">
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
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Sync Status */}
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Cloud className="w-5 h-5 text-blue-500" />
                    Data Sync
                </CardTitle>
                <CardDescription>Manage your offline data cache.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <div className="text-sm font-medium">Network Status</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <span className={cn("w-2 h-2 rounded-full", isOnline ? "bg-green-500" : "bg-red-500")} />
                            {isOnline ? "Online" : "Offline"}
                        </div>
                    </div>
                    
                    <div className="space-y-1 text-right">
                        <div className="text-sm font-medium">Last Synced</div>
                        <div className="text-sm text-muted-foreground">
                            {lastSyncedAt > 0 ? new Date(lastSyncedAt).toLocaleString() : "Never"}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* Security / Password */}
        <Card>
          <CardHeader>
             <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-orange-500" />
                Security
             </CardTitle>
             <CardDescription>Change your password.</CardDescription>
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
        
        {/* Delete Account Zone */}
        <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2">
                    <Trash2 className="h-5 w-5" /> Delete Account
                </CardTitle>
                <CardDescription>Permanently remove your access.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                    Deleting your account will remove your personal data and personal setlists. 
                    However, any public data you created (songs, public setlists, gigs) will remain for the band's use.
                    You will need to verify your email to reactivate your account in the future.
                </p>
                <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                    <DialogTrigger asChild>
                        <Button variant="destructive" className="w-full">Delete My Account</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Are you absolutely sure?</DialogTitle>
                            <DialogDescription>
                                This action marks your account as inactive. You will be logged out immediately.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={initiateDeleteAccount}>Yes, Delete Account</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>

        <div className="pt-4 flex justify-center">
            <Button variant="ghost" onClick={() => setShowSignOutConfirm(true)} className="text-muted-foreground">
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
                        {otpAction === 'delete' ? 'Verify & Delete' : 'Verify & Save'}
                     </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <AlertDialog open={showSignOutConfirm} onOpenChange={setShowSignOutConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign Out</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to sign out? This will clear your local data cache.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSignOut} className="bg-destructive hover:bg-destructive/90">Sign Out</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default Profile;