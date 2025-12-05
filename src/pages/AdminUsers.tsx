import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
import { Loader2, UserPlus, ChevronLeft, Search, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Profile {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: 'admin' | 'standard';
    position: string;
    avatar_url: string;
    created_at: string;
}

const AdminUsers = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    
    // Invite State
    const [inviteEmail, setInviteEmail] = useState("");
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [processing, setProcessing] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('first_name', { ascending: true });
        
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
            fetchUsers();
        } catch (err: any) {
            toast.error(err.message || "Failed to send invite");
        } finally {
            setProcessing(false);
        }
    };

    const filteredUsers = users.filter(user => 
        (user.first_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
        (user.last_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
        (user.email?.toLowerCase() || "").includes(searchQuery.toLowerCase())
    );

    return (
        <AppLayout>
            <div className="space-y-6 pb-20">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <Link to="/admin" className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent transition-colors">
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
                            <p className="text-sm text-muted-foreground">Manage members and permissions.</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search users..." 
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                            <DialogTrigger asChild>
                                <Button className="shrink-0">
                                    <UserPlus className="mr-2 h-4 w-4" /> Invite User
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Invite New Member</DialogTitle>
                                    <DialogDescription>
                                        Send an email invitation. They will receive a link to create an account.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                    <Input 
                                        placeholder="Email address" 
                                        type="email"
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
                </div>

                {loading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredUsers.length === 0 ? (
                            <div className="col-span-full text-center py-12 text-muted-foreground">
                                No users found matching your search.
                            </div>
                        ) : (
                            filteredUsers.map((user) => (
                                <Card 
                                    key={user.id} 
                                    className="p-4 hover:border-primary/50 transition-colors cursor-pointer active:scale-[0.98] duration-100"
                                    onClick={() => navigate(`/admin/users/${user.id}`)}
                                >
                                    <div className="flex items-center gap-4">
                                        <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                                            <AvatarImage src={user.avatar_url} />
                                            <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                                {user.first_name?.[0]}{user.last_name?.[0] || <User className="h-5 w-5" />}
                                            </AvatarFallback>
                                        </Avatar>
                                        
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h3 className="font-semibold truncate">
                                                    {user.first_name || "Unknown"} {user.last_name || ""}
                                                </h3>
                                                {user.role === 'admin' && (
                                                    <Badge variant="default" className="text-[10px] h-5 px-1.5">Admin</Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {user.position ? (
                                                    <Badge variant="secondary" className="font-normal text-xs">{user.position}</Badge>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">No position set</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                )}
            </div>
        </AppLayout>
    );
};

export default AdminUsers;