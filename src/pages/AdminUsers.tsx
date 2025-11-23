import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, UserPlus, Shield, Mail, Trash2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Profile {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: 'admin' | 'standard';
    position: string;
    created_at: string;
}

const AdminUsers = () => {
    const [users, setUsers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState("");
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [processing, setProcessing] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            toast.error("Failed to load users");
            console.error(error);
        } else {
            setUsers(data as any);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleRoleChange = async (userId: string, newRole: string) => {
        const oldUsers = [...users];
        // Optimistic update
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole as 'admin' | 'standard' } : u));

        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId);

        if (error) {
            toast.error("Failed to update role");
            setUsers(oldUsers); // Revert
        } else {
            toast.success("Role updated");
        }
    };

    const handleInvite = async () => {
        if (!inviteEmail) return;
        setProcessing(true);
        try {
            const { error } = await supabase.functions.invoke('admin-actions', {
                body: { action: 'invite', email: inviteEmail }
            });
            
            if (error) throw error;
            
            toast.success("Invite sent successfully");
            setIsInviteOpen(false);
            setInviteEmail("");
            fetchUsers(); // Refresh list
        } catch (err: any) {
            toast.error(err.message || "Failed to send invite");
        } finally {
            setProcessing(false);
        }
    };

    const handleResetPassword = async (email: string) => {
        if (!confirm(`Send password reset email to ${email}?`)) return;
        
        const toastId = toast.loading("Sending reset email...");
        try {
            const { error } = await supabase.functions.invoke('admin-actions', {
                body: { action: 'reset_password', email }
            });
            
            if (error) throw error;
            toast.success("Reset email sent", { id: toastId });
        } catch (err: any) {
            toast.error(err.message || "Failed to send reset email", { id: toastId });
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm("Are you sure? This will delete the user account and cannot be undone.")) return;
        
        const toastId = toast.loading("Deleting user...");
        try {
            const { error } = await supabase.functions.invoke('admin-actions', {
                body: { action: 'delete_user', userId }
            });
            
            if (error) throw error;
            
            setUsers(users.filter(u => u.id !== userId));
            toast.success("User deleted", { id: toastId });
        } catch (err: any) {
            toast.error(err.message || "Failed to delete user", { id: toastId });
        }
    };

    return (
        <AppLayout>
            <div className="space-y-6 pb-20">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
                        <p className="text-muted-foreground">Manage band members, roles, and access.</p>
                    </div>
                    <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <UserPlus className="mr-2 h-4 w-4" /> Invite User
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Invite New Member</DialogTitle>
                                <DialogDescription>
                                    Send an email invitation to a new band member. They will receive a link to set up their account.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                                <Input 
                                    placeholder="Email address" 
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsInviteOpen(false)}>Cancel</Button>
                                <Button onClick={handleInvite} disabled={processing}>
                                    {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Send Invite
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Members</CardTitle>
                        <CardDescription>
                            All registered users in the system.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex justify-center p-8">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Position</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {users.map((user) => (
                                            <TableRow key={user.id}>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{user.first_name} {user.last_name}</span>
                                                        <span className="text-xs text-muted-foreground">{user.email}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Select 
                                                        defaultValue={user.role} 
                                                        onValueChange={(val) => handleRoleChange(user.id, val)}
                                                    >
                                                        <SelectTrigger className="w-[110px] h-8">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="standard">Standard</SelectItem>
                                                            <SelectItem value="admin">Admin</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell>
                                                    {user.position ? (
                                                        <Badge variant="secondary">{user.position}</Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground text-sm">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon"
                                                            title="Reset Password"
                                                            onClick={() => handleResetPassword(user.email)}
                                                        >
                                                            <RefreshCw className="h-4 w-4 text-muted-foreground" />
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon"
                                                            title="Delete User"
                                                            className="hover:text-destructive"
                                                            onClick={() => handleDeleteUser(user.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
};

export default AdminUsers;