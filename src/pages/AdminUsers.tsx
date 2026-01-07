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
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { 
    Loader2, UserPlus, Ban, Lock, MoreVertical, Trash2, Power, EyeOff, ShieldAlert, CheckCircle2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { LoadingDialog } from "@/components/LoadingDialog";
import { Profile } from "@/types";

const POSITIONS = [
  "Lead Vocals", "Lead Guitar", "Rhythm Guitar", "Bass Guitar", 
  "Drums", "Keyboard/Piano", "Sound Engineer", "Lighting", "Other"
];

const AdminUsers = () => {
    const { session } = useAuth();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [bannedUsers, setBannedUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    
    // --- State for Dialogs ---
    const [inviteEmail, setInviteEmail] = useState("");
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    
    const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
    const [actionType, setActionType] = useState<'full_delete' | 'soft_delete' | 'deactivate' | 'ban' | 'reset_pass' | null>(null);
    const [confirmInput, setConfirmInput] = useState(""); // For "DELETE" confirmation or ban reason
    
    // Password Reset State
    const [resetPassword, setResetPassword] = useState("");
    
    const fetchData = async () => {
        setLoading(true);
        // Fetch Profiles
        const { data: pData, error: pError } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (pError) toast.error("Error fetching users: " + pError.message);
        if (pData) setProfiles(pData as Profile[]);

        // Fetch Bans
        const { data: bData } = await supabase
            .from('banned_users')
            .select('*')
            .order('banned_at', { ascending: false });
        if (bData) setBannedUsers(bData);
        
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
        const channel = supabase.channel('admin-dashboard')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'banned_users' }, () => fetchData())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    // --- Actions ---

    const handleUpdateField = async (userId: string, field: keyof Profile, value: any) => {
        // Optimistic update
        setProfiles(prev => prev.map(p => p.id === userId ? { ...p, [field]: value } : p));
        
        const { error } = await supabase.from('profiles').update({ [field]: value }).eq('id', userId);
        if (error) {
            toast.error(`Update failed: ${error.message}`);
            fetchData(); // Revert
        } else {
            toast.success("Updated");
        }
    };

    const handleAction = async () => {
        if (!selectedUser || !actionType) return;
        setProcessing(true);

        try {
            switch (actionType) {
                case 'deactivate':
                    await supabase.from('profiles').update({ is_active: false }).eq('id', selectedUser.id);
                    toast.success("User deactivated. They cannot log in until reactivated.");
                    break;

                case 'soft_delete':
                    await supabase.from('profiles').update({ 
                        deleted_at: new Date().toISOString(),
                        deleted_by: session?.user?.id 
                    }).eq('id', selectedUser.id);
                    toast.success("User soft deleted.");
                    break;

                case 'full_delete':
                    // Edge Function for Auth Deletion
                    const { error: fdError } = await supabase.functions.invoke('admin-actions', {
                        body: { action: 'delete_user_full', userId: selectedUser.id }
                    });
                    if (fdError) throw fdError;
                    toast.success("User account permanently deleted.");
                    break;

                case 'ban':
                    // Edge Function for Ban + Delete
                    const { error: banError } = await supabase.functions.invoke('admin-actions', {
                        body: { 
                            action: 'ban_user_and_delete', 
                            userId: selectedUser.id, 
                            email: selectedUser.email || "", // Email required for ban list
                            reason: confirmInput 
                        }
                    });
                    if (banError) throw banError;
                    toast.success("User banned and account removed.");
                    break;

                case 'reset_pass':
                    if (resetPassword.length < 6) throw new Error("Password too short");
                    const { error: rpError } = await supabase.functions.invoke('admin-actions', {
                        body: { 
                            action: 'admin_reset_password', 
                            userId: selectedUser.id, 
                            newPassword: resetPassword 
                        }
                    });
                    if (rpError) throw rpError;
                    toast.success("Password reset.");
                    break;
            }
            
            // Cleanup
            closeDialog();
            fetchData(); // Refresh list to reflect deletions/changes
        } catch (e: any) {
            console.error(e);
            toast.error("Action failed: " + (e.message || "Unknown error"));
        } finally {
            setProcessing(false);
        }
    };

    const handleInvite = async () => {
        setProcessing(true);
        const { error } = await supabase.functions.invoke('admin-actions', {
            body: { action: 'invite_user', email: inviteEmail }
        });
        setProcessing(false);
        
        if (error) toast.error("Invite failed: " + error.message);
        else {
            toast.success("Invitation sent");
            setIsInviteOpen(false);
            setInviteEmail("");
        }
    };

    const handleUnban = async (email: string) => {
        setProcessing(true);
        const { error } = await supabase.from('banned_users').delete().eq('email', email);
        if (error) toast.error(error.message);
        else toast.success("User unbanned");
        setProcessing(false);
    };

    const closeDialog = () => {
        setSelectedUser(null);
        setActionType(null);
        setConfirmInput("");
        setResetPassword("");
    };

    // --- Derived State ---
    const activeUsers = profiles.filter(p => !p.deleted_at && p.is_approved && p.is_active);
    const pendingUsers = profiles.filter(p => !p.is_approved && !p.deleted_at);
    const inactiveUsers = profiles.filter(p => (p.deleted_at || !p.is_active) && p.is_approved);

    return (
        <AppLayout>
            <LoadingDialog open={processing} message="Processing admin action..." />
            <div className="space-y-6 pb-20">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Manage Users</h1>
                        <p className="text-muted-foreground">Control access, roles, and account status.</p>
                    </div>
                    <Button onClick={() => setIsInviteOpen(true)}>
                        <UserPlus className="mr-2 h-4 w-4" /> Invite User
                    </Button>
                </div>

                <Tabs defaultValue="active" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 overflow-x-auto">
                        <TabsTrigger value="active">Active ({activeUsers.length})</TabsTrigger>
                        <TabsTrigger value="pending" className="relative">
                            Pending
                            {pendingUsers.length > 0 && (
                                <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                                    {pendingUsers.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="inactive">Inactive ({inactiveUsers.length})</TabsTrigger>
                        <TabsTrigger value="banned">Banned ({bannedUsers.length})</TabsTrigger>
                    </TabsList>

                    {/* ACTIVE USERS TABLE */}
                    <TabsContent value="active">
                        <Card>
                            <CardHeader><CardTitle>Active Members</CardTitle></CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader><TableRow><TableHead>Name / Email</TableHead><TableHead>Role</TableHead><TableHead>Position</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {activeUsers.map(user => (
                                            <TableRow key={user.id}>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{user.first_name} {user.last_name}</span>
                                                        <span className="text-xs text-muted-foreground">{/* Email isn't in public profile by default, depends on sync. Assuming mapped or joined. */ }</span> 
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Select value={user.role} onValueChange={(v) => handleUpdateField(user.id, 'role', v)}>
                                                        <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="standard">Standard</SelectItem>
                                                            <SelectItem value="manager">Manager</SelectItem>
                                                            <SelectItem value="admin">Admin</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell>
                                                    <Select value={user.position || "Other"} onValueChange={(v) => handleUpdateField(user.id, 'position', v)}>
                                                        <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            {POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <UserActionsDropdown user={user} onAction={(type) => { setSelectedUser(user); setActionType(type); }} />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* PENDING USERS TABLE */}
                    <TabsContent value="pending">
                        <Card>
                            <CardHeader><CardTitle>Pending Approvals</CardTitle></CardHeader>
                            <CardContent>
                                {pendingUsers.length === 0 ? <div className="text-center py-8 text-muted-foreground">No pending requests.</div> : (
                                    <Table>
                                        <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Position</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {pendingUsers.map(user => (
                                                <TableRow key={user.id}>
                                                    <TableCell>
                                                        <div className="font-medium">{user.first_name} {user.last_name}</div>
                                                    </TableCell>
                                                    <TableCell>{user.position}</TableCell>
                                                    <TableCell className="text-right space-x-2">
                                                        <Button size="sm" variant="destructive" onClick={() => { setSelectedUser(user); setActionType('ban'); }}>Deny</Button>
                                                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleUpdateField(user.id, 'is_approved', true)}>Approve</Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* INACTIVE USERS TABLE */}
                    <TabsContent value="inactive">
                        <Card>
                            <CardHeader><CardTitle>Inactive & Soft Deleted</CardTitle></CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {inactiveUsers.map(user => (
                                            <TableRow key={user.id} className="opacity-70">
                                                <TableCell>
                                                    <div className="font-medium">{user.first_name} {user.last_name}</div>
                                                </TableCell>
                                                <TableCell>
                                                    {user.deleted_at ? <Badge variant="destructive">Soft Deleted</Badge> : <Badge variant="secondary">Deactivated</Badge>}
                                                </TableCell>
                                                <TableCell className="text-right space-x-2">
                                                    <Button size="sm" variant="outline" onClick={() => {
                                                        // Restore
                                                        handleUpdateField(user.id, 'is_active', true);
                                                        handleUpdateField(user.id, 'deleted_at', null);
                                                    }}>Restore</Button>
                                                    <Button size="sm" variant="destructive" onClick={() => { setSelectedUser(user); setActionType('full_delete'); }}>Hard Delete</Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* BANNED USERS TABLE */}
                    <TabsContent value="banned">
                        <Card>
                            <CardHeader><CardTitle>Banned Emails</CardTitle></CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {bannedUsers.map(ban => (
                                            <TableRow key={ban.id}>
                                                <TableCell>{ban.email}</TableCell>
                                                <TableCell className="text-muted-foreground">{ban.reason}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="outline" size="sm" onClick={() => handleUnban(ban.email)}>Unban</Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* --- MODALS --- */}

                <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Invite Member</DialogTitle><DialogDescription>Sends an email invitation.</DialogDescription></DialogHeader>
                        <Input placeholder="Email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                        <DialogFooter><Button onClick={handleInvite}>Send Invite</Button></DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Action Confirmation Dialog */}
                <Dialog open={!!actionType} onOpenChange={() => closeDialog()}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {actionType === 'full_delete' && "Permanently Delete User"}
                                {actionType === 'soft_delete' && "Soft Delete User"}
                                {actionType === 'deactivate' && "Deactivate User"}
                                {actionType === 'ban' && "Ban User"}
                                {actionType === 'reset_pass' && "Reset Password"}
                            </DialogTitle>
                            <DialogDescription>
                                {actionType === 'full_delete' && "This will remove the user from Authentication and Profile tables. THIS CANNOT BE UNDONE."}
                                {actionType === 'soft_delete' && "This marks the user as deleted but keeps the record. They cannot log in."}
                                {actionType === 'deactivate' && "Temporarily disables login access."}
                                {actionType === 'ban' && "This will delete the account and block the email from registering again."}
                                {actionType === 'reset_pass' && "Set a new password for this user."}
                            </DialogDescription>
                        </DialogHeader>

                        {actionType === 'reset_pass' && (
                            <div className="py-2">
                                <Label>New Password</Label>
                                <Input type="text" value={resetPassword} onChange={e => setResetPassword(e.target.value)} placeholder="Min 6 chars" />
                            </div>
                        )}

                        {actionType === 'ban' && (
                            <div className="py-2">
                                <Label>Reason</Label>
                                <Input value={confirmInput} onChange={e => setConfirmInput(e.target.value)} placeholder="Reason for ban" />
                            </div>
                        )}

                        <DialogFooter>
                            <Button variant="ghost" onClick={closeDialog}>Cancel</Button>
                            <Button 
                                variant={actionType === 'reset_pass' ? 'default' : 'destructive'} 
                                onClick={handleAction}
                            >
                                Confirm
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
};

const UserActionsDropdown = ({ user, onAction }: { user: Profile, onAction: (type: any) => void }) => (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
            <DropdownMenuLabel>Account Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onAction('reset_pass')}>
                <Lock className="mr-2 h-4 w-4" /> Reset Password
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onAction('deactivate')}>
                <Power className="mr-2 h-4 w-4" /> Deactivate (Disable Login)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction('soft_delete')} className="text-orange-600">
                <EyeOff className="mr-2 h-4 w-4" /> Soft Delete (Archive)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction('full_delete')} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Full Delete (Permanent)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onAction('ban')} className="text-destructive font-bold">
                <ShieldAlert className="mr-2 h-4 w-4" /> Ban User
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
);

export default AdminUsers;