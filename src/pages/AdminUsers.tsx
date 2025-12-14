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
    DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { 
    Loader2, UserPlus, Shield, UserCheck, UserX, Trash2, RefreshCw, Ban, CheckCircle 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Profile {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: 'admin' | 'standard';
    position: string;
    is_approved: boolean;
    is_active: boolean;
    created_at: string;
}

interface BannedUser {
    id: string;
    email: string;
    reason: string;
    banned_at: string;
}

const AdminUsers = () => {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Invite State
    const [inviteEmail, setInviteEmail] = useState("");
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    
    // Ban State
    const [banReason, setBanReason] = useState("");
    const [userToBan, setUserToBan] = useState<Profile | null>(null);
    const [isBanOpen, setIsBanOpen] = useState(false);
    
    const [processing, setProcessing] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        // Fetch Profiles
        const { data: pData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        if (pData) setProfiles(pData as any);

        // Fetch Banned
        const { data: bData } = await supabase.from('banned_users').select('*').order('banned_at', { ascending: false });
        if (bData) setBannedUsers(bData as any);
        
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Logic to separate users
    const activeUsers = profiles.filter(p => p.is_approved && p.is_active);
    const pendingUsers = profiles.filter(p => !p.is_approved);
    // Inactive users (soft deleted) are currently mixed in activeUsers but we can filter if needed, 
    // but the request implied "User Management" vs "Approvals". 

    const handleRoleChange = async (userId: string, newRole: string) => {
        const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
        if (error) toast.error("Failed to update role");
        else {
            toast.success("Role updated");
            fetchData();
        }
    };

    const handleApprove = async (userId: string) => {
        setProcessing(true);
        try {
            const { error } = await supabase.functions.invoke('admin-actions', {
                body: { action: 'approve_user', userId }
            });
            if (error) throw error;
            toast.success("User approved");
            fetchData();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setProcessing(false);
        }
    };

    const initiateBan = (user: Profile) => {
        setUserToBan(user);
        setIsBanOpen(true);
    };

    const handleBan = async () => {
        if (!userToBan) return;
        setProcessing(true);
        try {
            const { error } = await supabase.functions.invoke('admin-actions', {
                body: { 
                    action: 'deny_ban_user', 
                    userId: userToBan.id, 
                    email: userToBan.email,
                    reason: banReason 
                }
            });
            if (error) throw error;
            toast.success("User banned and removed");
            setIsBanOpen(false);
            setBanReason("");
            setUserToBan(null);
            fetchData();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleUnban = async (email: string) => {
        if (!confirm("Unban this email address? This allows them to sign up again.")) return;
        setProcessing(true);
        try {
            const { error } = await supabase.functions.invoke('admin-actions', {
                body: { action: 'unban_user', email }
            });
            if (error) throw error;
            toast.success("User unbanned");
            fetchData();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleInvite = async () => {
        setProcessing(true);
        const { error } = await supabase.functions.invoke('admin-actions', {
            body: { action: 'invite', email: inviteEmail }
        });
        if (error) toast.error("Failed to invite");
        else {
            toast.success("Invite sent");
            setIsInviteOpen(false);
            setInviteEmail("");
        }
        setProcessing(false);
    };

    return (
        <AppLayout>
            <div className="space-y-6 pb-20">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                        <p className="text-muted-foreground">Manage users, approvals, and security.</p>
                    </div>
                    <Button onClick={() => setIsInviteOpen(true)}>
                        <UserPlus className="mr-2 h-4 w-4" /> Invite Member
                    </Button>
                </div>

                <Tabs defaultValue="users" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="users">Active Users ({activeUsers.length})</TabsTrigger>
                        <TabsTrigger value="approvals" className="relative">
                            Approvals
                            {pendingUsers.length > 0 && (
                                <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                                    {pendingUsers.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="bans">Banned ({bannedUsers.length})</TabsTrigger>
                    </TabsList>

                    {/* ACTIVE USERS TAB */}
                    <TabsContent value="users">
                        <Card>
                            <CardHeader>
                                <CardTitle>User Management</CardTitle>
                                <CardDescription>Manage roles and access for approved users.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loading ? <Loader2 className="animate-spin mx-auto" /> : (
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {activeUsers.map(user => (
                                                <TableRow key={user.id}>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{user.first_name} {user.last_name}</span>
                                                            <span className="text-xs text-muted-foreground">{user.email}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Select defaultValue={user.role} onValueChange={(v) => handleRoleChange(user.id, v)}>
                                                            <SelectTrigger className="w-[110px] h-8"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="standard">Standard</SelectItem>
                                                                <SelectItem value="admin">Admin</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => initiateBan(user)} title="Ban User">
                                                            <Ban className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* APPROVALS TAB */}
                    <TabsContent value="approvals">
                        <Card>
                            <CardHeader>
                                <CardTitle>Pending Approvals</CardTitle>
                                <CardDescription>New signups waiting for access.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {pendingUsers.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">No pending requests.</div>
                                ) : (
                                    <Table>
                                        <TableHeader><TableRow><TableHead>User</TableHead><TableHead className="text-right">Decision</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {pendingUsers.map(user => (
                                                <TableRow key={user.id}>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{user.first_name || "Unfinished Profile"} {user.last_name}</span>
                                                            <span className="text-xs text-muted-foreground">{user.email}</span>
                                                            <span className="text-[10px] text-muted-foreground">Joined: {new Date(user.created_at).toLocaleDateString()}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right space-x-2">
                                                        <Button size="sm" variant="destructive" onClick={() => initiateBan(user)} disabled={processing}>
                                                            Deny
                                                        </Button>
                                                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApprove(user.id)} disabled={processing}>
                                                            Approve
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* BANS TAB */}
                    <TabsContent value="bans">
                        <Card>
                             <CardHeader>
                                <CardTitle>Banned Users</CardTitle>
                                <CardDescription>Emails blocked from signing up or logging in.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {bannedUsers.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">No bans active.</div>
                                ) : (
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {bannedUsers.map(ban => (
                                                <TableRow key={ban.id}>
                                                    <TableCell>{ban.email}</TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">{ban.reason || "No reason provided"}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="outline" size="sm" onClick={() => handleUnban(ban.email)} disabled={processing}>
                                                            Unban
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Invite Modal */}
                <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Invite Member</DialogTitle></DialogHeader>
                        <Input placeholder="Email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                        <DialogFooter><Button onClick={handleInvite} disabled={processing}>Send</Button></DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Ban Modal */}
                <Dialog open={isBanOpen} onOpenChange={setIsBanOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Deny & Ban User</DialogTitle>
                            <DialogDescription>
                                This will delete the user's account and add their email to the ban list.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-2">
                            <p className="font-medium mb-2">Banning: {userToBan?.email}</p>
                            <Input placeholder="Reason for ban (optional)" value={banReason} onChange={e => setBanReason(e.target.value)} />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsBanOpen(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={handleBan} disabled={processing}>Confirm Ban</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
};

export default AdminUsers;