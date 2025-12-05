import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, ChevronLeft, Save, Trash2, Shield, RefreshCw } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const POSITIONS = [
  'Lead Vocals', 
  'Lead Guitar', 
  'Rhythm Guitar', 
  'Bass Guitar', 
  'Drums', 
  'Keyboard/Piano', 
  'Sound Engineer', 
  'Lighting', 
  'Other'
];

interface ProfileData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'admin' | 'standard';
  position: string;
}

const AdminUserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!id) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        toast.error("Failed to load user profile");
        navigate("/admin/users");
      } else {
        setProfile(data as any);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [id, navigate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);

    try {
        // 1. Update Profile Table (Admin has RLS permission)
        const { error: profileError } = await supabase
            .from('profiles')
            .update({
                first_name: profile.first_name,
                last_name: profile.last_name,
                position: profile.position,
                role: profile.role
            })
            .eq('id', profile.id);

        if (profileError) throw profileError;

        // 2. Sync to Auth Metadata via Edge Function
        const { error: authError } = await supabase.functions.invoke('admin-actions', {
            body: { 
                action: 'update_user', 
                userId: profile.id,
                firstName: profile.first_name,
                lastName: profile.last_name
            }
        });

        if (authError) {
            console.error("Auth sync warning:", authError);
            toast.warning("Profile saved, but auth metadata sync failed.");
        } else {
            toast.success("User profile updated successfully");
        }
        
    } catch (error: any) {
        toast.error("Failed to update profile: " + error.message);
    } finally {
        setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!profile) return;
    const toastId = toast.loading("Deleting user...");
    
    try {
        const { error } = await supabase.functions.invoke('admin-actions', {
            body: { action: 'delete_user', userId: profile.id }
        });
        
        if (error) throw error;
        
        toast.success("User deleted", { id: toastId });
        navigate("/admin/users");
    } catch (err: any) {
        toast.error(err.message || "Failed to delete user", { id: toastId });
    }
  };

  const handleResetPassword = async () => {
    if (!profile?.email) return;
    const toastId = toast.loading("Sending reset email...");
    
    try {
        const { error } = await supabase.functions.invoke('admin-actions', {
            body: { action: 'reset_password', email: profile.email }
        });
        
        if (error) throw error;
        toast.success("Reset email sent", { id: toastId });
    } catch (err: any) {
        toast.error(err.message || "Failed to send reset email", { id: toastId });
    }
  };

  if (loading) return (
    <AppLayout>
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </AppLayout>
  );

  if (!profile) return null;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl mx-auto pb-20">
        <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/users")}>
                <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Edit User</h1>
                <p className="text-muted-foreground text-sm">{profile.email}</p>
            </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>Update personal details and band role.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="firstName">First Name</Label>
                            <Input
                                id="firstName"
                                value={profile.first_name || ""}
                                onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="lastName">Last Name</Label>
                            <Input
                                id="lastName"
                                value={profile.last_name || ""}
                                onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="position">Band Position</Label>
                        <Select 
                            value={profile.position || ""} 
                            onValueChange={(val) => setProfile({ ...profile, position: val })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select position" />
                            </SelectTrigger>
                            <SelectContent>
                                {POSITIONS.map((pos) => (
                                    <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-blue-500" />
                        Permissions & Access
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="role">System Role</Label>
                        <Select 
                            value={profile.role || "standard"} 
                            onValueChange={(val: any) => setProfile({ ...profile, role: val })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="standard">Standard Member</SelectItem>
                                <SelectItem value="admin">Administrator</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            Admins have full access to user management and system settings.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <Button type="submit" className="flex-1" disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" /> Save Changes
                </Button>
            </div>
        </form>

        <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 bg-background rounded-lg border">
                    <div className="text-sm">
                        <span className="font-semibold block">Password Reset</span>
                        <span className="text-muted-foreground">Send a password reset email to the user.</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleResetPassword}>
                        <RefreshCw className="mr-2 h-3 w-3" /> Send Email
                    </Button>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 bg-background rounded-lg border border-destructive/20">
                    <div className="text-sm">
                        <span className="font-semibold block text-destructive">Delete Account</span>
                        <span className="text-muted-foreground">Permanently remove this user and their data.</span>
                    </div>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                                <Trash2 className="mr-2 h-3 w-3" /> Delete User
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the account for 
                                    <span className="font-medium text-foreground"> {profile.email}</span>.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive hover:bg-destructive/90">
                                    Delete Account
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminUserDetail;