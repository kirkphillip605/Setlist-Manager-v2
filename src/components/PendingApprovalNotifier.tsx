import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { UserPlus, X, Check, Ban } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export const PendingApprovalNotifier = () => {
  const { isAdmin, session } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [showDialog, setShowDialog] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [isDisabled, setIsDisabled] = useState(false);

  const fetchPending = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('is_approved', false);
      if (data) {
          setPendingUsers(data);
          setPendingCount(data.length);
      }
  };

  useEffect(() => {
    if (!isAdmin) return;

    fetchPending();

    const channel = supabase
      .channel('admin_approvals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchPending())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAdmin]);

  const handleAction = async (action: 'approve' | 'deny', userId: string, email?: string) => {
      try {
          if (action === 'approve') {
              // Direct DB Update (Allowed by RLS)
              const { error } = await supabase
                .from('profiles')
                .update({ is_approved: true })
                .eq('id', userId);
              
              if (error) throw error;
              toast.success("User Approved");
          } 
          else {
              // Deny = Ban & Delete
              if (!email) throw new Error("Email required for ban");
              
              // 1. Insert Ban (Allowed by RLS)
              const { error: banError } = await supabase.from('banned_users').insert({
                  email, 
                  reason: 'Denied via quick action',
                  banned_by: session?.user?.id
              });
              if (banError) throw banError;

              // 2. Delete Auth (Edge Function)
              const { error: funcError } = await supabase.functions.invoke('admin-actions', { 
                  body: { action: 'delete_user_auth', userId } 
              });
              if (funcError) throw funcError;

              toast.success("User Denied & Blocked");
          }
      } catch (e: any) {
          toast.error("Action failed: " + e.message);
      }
  };

  if (!isAdmin || pendingCount === 0 || isDisabled) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-20 right-4 z-50 md:bottom-8"
        >
            <div className="bg-primary text-primary-foreground p-4 rounded-lg shadow-lg flex items-center gap-4 cursor-pointer hover:bg-primary/90 transition-colors" onClick={() => setShowDialog(true)}>
                <div className="relative">
                    <UserPlus className="h-6 w-6" />
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full border-2 border-primary">
                        {pendingCount}
                    </span>
                </div>
                <div className="flex-1">
                    <p className="font-bold text-sm">Approval Requests</p>
                    <p className="text-xs opacity-90">{pendingCount} user{pendingCount !== 1 ? 's' : ''} waiting</p>
                </div>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 hover:bg-primary-foreground/20 text-primary-foreground -mr-2"
                    onClick={(e) => { e.stopPropagation(); setIsDisabled(true); }}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </motion.div>
      </AnimatePresence>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle>Pending Approvals</DialogTitle>
                <DialogDescription>Quickly review access requests.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
                {pendingUsers.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                        <div className="min-w-0 flex-1 mr-2">
                            <p className="font-medium truncate">{user.first_name} {user.last_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{user.position || "No position set"}</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <Button size="icon" variant="outline" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleAction('deny', user.id, user.email)}>
                                <Ban className="h-4 w-4" />
                            </Button>
                            <Button size="icon" className="h-8 w-8 bg-green-600 hover:bg-green-700" onClick={() => handleAction('approve', user.id)}>
                                <Check className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setShowDialog(false)}>Close</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};