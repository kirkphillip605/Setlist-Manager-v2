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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 2. Verify Admin
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') throw new Error('Forbidden: Admins only');

    const { action, email, userId, newPassword } = await req.json();
    let logMessage = "";

    // --- AUTH ACTIONS ONLY ---

    if (action === 'invite') {
      const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
      if (error) throw error;
      logMessage = `Invited ${email}`;
    }

    else if (action === 'delete_user_auth') {
       // Only deletes from Auth. Profile/DB cleanup handled by Foreign Keys (CASCADE) or Client.
       const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
       if (error) throw error;
       logMessage = `Deleted user ${userId} from Auth`;
    }

    else if (action === 'admin_reset_password') {
        if (!newPassword || newPassword.length < 6) throw new Error("Password too short");
        
        const { error } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            { password: newPassword }
        );
        if (error) throw error;
        
        // Update profile flag directly via admin client to ensure consistency
        await supabaseAdmin.from('profiles').update({ has_password: true }).eq('id', userId);
        
        logMessage = `Reset password for ${userId}`;
    }
    else {
        throw new Error(`Invalid or unsupported action: ${action}`);
    }

    // Log Action
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