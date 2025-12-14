import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { 
    Loader2, UserPlus, Shield, Ban, Lock, Activity
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getLogs } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const POSITIONS = [
  "Lead Vocals", "Lead Guitar", "Rhythm Guitar", "Bass Guitar", 
  "Drums", "Keyboard/Piano", "Sound Engineer", "Lighting", "Other"
];

const AdminUsers = () => {
    const { session } = useAuth();
    const [profiles, setProfiles] = useState<any[]>([]);
    const [bannedUsers, setBannedUsers] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDisabled, setShowDisabled] = useState(false);
    
    // Dialog States
    const [inviteEmail, setInviteEmail] = useState("");
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    
    // Ban State
    const [banReason, setBanReason] = useState("");
    const [userToBan, setUserToBan] = useState<any>(null);
    const [isBanOpen, setIsBanOpen] = useState(false);
    
    // Reset Password State
    const [resetUser, setResetUser] = useState<any>(null);
    const [newPassword, setNewPassword] = useState("");
    const [adminOtp, setAdminOtp] = useState("");
    const [isResetOpen, setIsResetOpen] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    
    const [processing, setProcessing] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        const { data: pData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        if (pData) setProfiles(pData);

        const { data: bData } = await supabase.from('banned_users').select('*').order('banned_at', { ascending: false });
        if (bData) setBannedUsers(bData);

        const lData = await getLogs();
        if (lData) setLogs(lData);
        
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
        const channel = supabase.channel('admin-dashboard')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'banned_users' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, () => fetchData())
            .subscribe();
            
        return () => { supabase.removeChannel(channel); };
    }, []);

    const pendingUsers = profiles.filter(p => !p.is_approved);
    const appUsers = profiles.filter(p => p.is_approved && (showDisabled || p.is_active));

    // --- HELPER ACTIONS ---

    const initiateBan = (user: any) => {
        setUserToBan(user);
        setBanReason("");
        setIsBanOpen(true);
    };

    const handleUpdateProfile = async (userId: string, updates: any) => {
        const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
        if (error) toast.error("Update failed: " + error.message);
        else toast.success("User updated");
    };

    const handleRoleChange = (userId: string, newRole: string) => handleUpdateProfile(userId, { role: newRole });
    const handlePositionChange = (userId: string, newPos: string) => handleUpdateProfile(userId, { position: newPos });
    const handleApprove = (userId: string) => handleUpdateProfile(userId, { is_approved: true });

    const handleBan = async () => {
        if (!userToBan) return;
        setProcessing(true);
        
        // 1. Client-side: Insert into banned_users (Allowed by RLS)
        const { error: banError } = await supabase.from('banned_users').insert({
            email: userToBan.email,
            reason: banReason,
            banned_by: session?.user?.id
        });

        if (banError) {
            toast.error("Failed to ban: " + banError.message);
            setProcessing(false);
            return;
        }

        // 2. Edge Function: Delete User from Auth (Strictly required)
        try {
            const { error } = await supabase.functions.invoke('admin-actions', {
                body: { action: 'delete_user_auth', userId: userToBan.id }
            });
            if (error) throw new Error(error.message || "Auth deletion failed");
            
            toast.success("User banned and removed");
            setIsBanOpen(false);
            setBanReason("");
            setUserToBan(null);
        } catch (e: any) {
            toast.error("User banned, but Auth cleanup failed: " + e.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleUnban = async (email: string) => {
        if (!confirm("Unban this email address? The user will need to register again.")) return;
        setProcessing(true);
        
        const { error } = await supabase.from('banned_users').delete().eq('email', email);
        if (error) toast.error("Failed to unban: " + error.message);
        else toast.success("User unbanned");
        
        setProcessing(false);
    };

    const handleInvite = async () => {
        setProcessing(true);
        try {
            const { error } = await supabase.functions.invoke('admin-actions', {
                body: { action: 'invite', email: inviteEmail }
            });
            if (error) throw new Error(error.message || "Request failed");
            
            toast.success("Invite sent");
            setIsInviteOpen(false);
            setInviteEmail("");
        } catch(e: any) {
            toast.error("Failed to invite: " + e.message);
        } finally {
            setProcessing(false);
        }
    };

    const initiateReset = async (user: any) => {
        setResetUser(user);
        setIsResetOpen(true);
        setOtpSent(false);
        setAdminOtp("");
        setNewPassword("");
        
        const { error } = await supabase.auth.signInWithOtp({
            email: session?.user?.email!,
            options: { shouldCreateUser: false }
        });
        
        if (error) toast.error(error.message);
        else {
            setOtpSent(true);
            toast.info("Verification code sent to your email");
        }
    };

    const handleResetPassword = async () => {
        if (adminOtp.length !== 6 || newPassword.length < 6) return;
        setProcessing(true);

        try {
            const { error: otpError } = await supabase.auth.verifyOtp({
                email: session?.user?.email!,
                token: adminOtp,
                type: 'email'
            });
            if (otpError) throw new Error("Invalid code");

            const { error: funcError } = await supabase.functions.invoke('admin-actions', {
                body: { 
                    action: 'admin_reset_password', 
                    userId: resetUser.id,
                    newPassword: newPassword
                }
            });
            if (funcError) throw funcError;

            toast.success("Password reset successfully");
            setIsResetOpen(false);
        } catch (e: any) {
            toast.error(e.message || "Reset failed");
        } finally {
            setProcessing(false);
        }
    };

    return (
        <AppLayout>
            <div className="space-y-6 pb-20">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                        <p className="text-muted-foreground">Manage users, approvals, logs and security.</p>
                    </div>
                    <Button onClick={() => setIsInviteOpen(true)}>
                        <UserPlus className="mr-2 h-4 w-4" /> Invite Member
                    </Button>
                </div>

                <Tabs defaultValue="users" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 overflow-x-auto">
                        <TabsTrigger value="users">App Users</TabsTrigger>
                        <TabsTrigger value="approvals" className="relative">
                            Approvals
                            {pendingUsers.length > 0 && (
                                <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                                    {pendingUsers.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="bans">Bans</TabsTrigger>
                        <TabsTrigger value="logs">Logs</TabsTrigger>
                    </TabsList>

                    <TabsContent value="users">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div><CardTitle>App Users</CardTitle><CardDescription>Manage roles and positions.</CardDescription></div>
                                <div className="flex items-center gap-2">
                                    <Checkbox id="showDis" checked={showDisabled} onCheckedChange={(c) => setShowDisabled(!!c)} />
                                    <Label htmlFor="showDis" className="text-sm">Show Inactive</Label>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {loading ? <Loader2 className="animate-spin mx-auto" /> : (
                                    <Table>
                                        <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Position</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {appUsers.map(user => (
                                                <TableRow key={user.id} className={!user.is_active ? "opacity-50 bg-muted/50" : ""}>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium flex items-center gap-2">
                                                                {user.first_name} {user.last_name}
                                                                {!user.is_active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">{user.email}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Select defaultValue={user.role} onValueChange={(v) => handleRoleChange(user.id, v)}>
                                                            <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="standard">Standard</SelectItem>
                                                                <SelectItem value="admin">Admin</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Select defaultValue={user.position || "Other"} onValueChange={(v) => handlePositionChange(user.id, v)}>
                                                            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                {POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1">
                                                            <Button variant="ghost" size="icon" className="text-blue-500 hover:text-blue-700" onClick={() => initiateReset(user)} title="Reset Password">
                                                                <Lock className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => initiateBan(user)} title="Ban User">
                                                                <Ban className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="approvals">
                        <Card>
                            <CardHeader><CardTitle>Pending Approvals</CardTitle></CardHeader>
                            <CardContent>
                                {pendingUsers.length === 0 ? <div className="text-center py-8 text-muted-foreground">No pending requests.</div> : (
                                    <Table>
                                        <TableHeader><TableRow><TableHead>User</TableHead><TableHead className="text-right">Decision</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {pendingUsers.map(user => (
                                                <TableRow key={user.id}>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{user.first_name || "Unfinished"} {user.last_name}</span>
                                                            <span className="text-xs text-muted-foreground">{user.email}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right space-x-2">
                                                        <Button size="sm" variant="destructive" onClick={() => initiateBan(user)} disabled={processing}>Deny</Button>
                                                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApprove(user.id)} disabled={processing}>Approve</Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="bans">
                        <Card>
                             <CardHeader><CardTitle>Banned Users</CardTitle></CardHeader>
                            <CardContent>
                                {bannedUsers.length === 0 ? <div className="text-center py-8 text-muted-foreground">No bans active.</div> : (
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {bannedUsers.map(ban => (
                                                <TableRow key={ban.id}>
                                                    <TableCell>{ban.email}</TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">{ban.reason}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="outline" size="sm" onClick={() => handleUnban(ban.email)} disabled={processing}>Unban</Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="logs">
                        <Card>
                            <CardHeader><CardTitle>System Logs</CardTitle></CardHeader>
                            <CardContent>
                                {logs.length === 0 ? <div className="text-center py-8 text-muted-foreground">No logs found.</div> : (
                                    <div className="space-y-4 max-h-[600px] overflow-y-auto">
                                        {logs.map(log => (
                                            <div key={log.id} className="flex gap-3 text-sm border-b pb-2 last:border-0">
                                                <div className="mt-0.5">
                                                    {log.action_type && ['LOGIN', 'BAN_USER', 'APPROVE_USER'].includes(log.action_type) 
                                                        ? <Shield className="h-4 w-4 text-blue-500" /> 
                                                        : <Activity className="h-4 w-4 text-green-500" />
                                                    }
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-medium text-xs text-muted-foreground mb-0.5">
                                                        {log.action_type} • {log.resource_type}
                                                    </p>
                                                    <div className="text-sm">
                                                        {JSON.stringify(log.details)}
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground mt-1">
                                                        {new Date(log.created_at).toLocaleString()} • {log.user?.email || 'System'}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Invite Member</DialogTitle></DialogHeader>
                        <Input placeholder="Email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                        <DialogFooter><Button onClick={handleInvite} disabled={processing}>Send</Button></DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={isBanOpen} onOpenChange={setIsBanOpen}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Ban User</DialogTitle></DialogHeader>
                        <div className="py-2"><Input placeholder="Reason" value={banReason} onChange={e => setBanReason(e.target.value)} /></div>
                        <DialogFooter><Button variant="destructive" onClick={handleBan} disabled={processing}>Confirm</Button></DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
                        <div className="space-y-2 py-2">
                            <Label>Admin Code</Label>
                            <InputOTP maxLength={6} value={adminOtp} onChange={setAdminOtp}><InputOTPGroup><InputOTPSlot index={0}/><InputOTPSlot index={1}/><InputOTPSlot index={2}/></InputOTPGroup><div className="w-2"/><InputOTPGroup><InputOTPSlot index={3}/><InputOTPSlot index={4}/><InputOTPSlot index={5}/></InputOTPGroup></InputOTP>
                            <Label>New User Password</Label>
                            <Input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 chars" />
                        </div>
                        <DialogFooter><Button onClick={handleResetPassword} disabled={processing || adminOtp.length !== 6 || newPassword.length < 6}>Reset</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
};

export default AdminUsers;