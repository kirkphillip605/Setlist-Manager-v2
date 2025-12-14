// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // 1. Setup Clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Client for verifying the caller
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, { 
      global: { headers: { Authorization: req.headers.get('Authorization')! } } 
    });

    // Admin client for Auth API operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Verify Requestor is Admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') throw new Error('Forbidden: Admins only');

    // 3. Parse Body
    const { action, email, userId, newPassword } = await req.json();
    let logMessage = "";

    // --- AUTH ACTIONS ONLY (Requires Service Role) ---

    if (action === 'invite') {
      if (!email) throw new Error("Email required");
      const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
      if (error) throw error;
      logMessage = `Invited ${email}`;
    }

    else if (action === 'delete_user_auth') {
       if (!userId) throw new Error("User ID required");
       const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
       if (error) throw error;
       logMessage = `Deleted user ${userId} from Auth`;
    }

    else if (action === 'admin_reset_password') {
        if (!userId || !newPassword) throw new Error("ID and Password required");
        if (newPassword.length < 6) throw new Error("Password too short");
        
        const { error } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            { password: newPassword }
        );
        if (error) throw error;
        
        // Sync profile flag (optional, but good for consistency)
        await supabaseAdmin.from('profiles').update({ has_password: true }).eq('id', userId);
        
        logMessage = `Reset password for ${userId}`;
    }
    
    else {
        throw new Error(`Invalid action: ${action}`);
    }

    // 4. Log Action
    if (logMessage) {
        await supabaseAdmin.from('activity_logs').insert({
            user_id: user.id,
            action_type: action.toUpperCase(),
            resource_type: 'auth',
            resource_id: userId || email,
            details: { message: logMessage }
        });
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});