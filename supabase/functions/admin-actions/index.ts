// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 2. Client Setup
    // Use the User's JWT to verify they are an admin
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Use Service Role for actual admin actions (bypass RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 3. Verify Requestor is Admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') throw new Error('Forbidden: Admins only');

    // 4. Parse Body
    const { action, email, userId, reason, newPassword, targetPosition } = await req.json();
    let logEntry = null;

    // --- EXECUTE ACTIONS ---

    if (action === 'invite') {
      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
      if (error) throw error;
      
      logEntry = {
        action_type: 'INVITE_USER',
        resource_type: 'auth',
        details: { target_email: email }
      };
    }

    else if (action === 'approve_user') {
       const { error } = await supabaseAdmin
        .from('profiles')
        .update({ is_approved: true })
        .eq('id', userId);
       if (error) throw error;

       logEntry = {
        action_type: 'APPROVE_USER',
        resource_type: 'profile',
        resource_id: userId,
        details: {}
      };
    }

    else if (action === 'deny_ban_user') {
       // Add to ban table
       const { error: banError } = await supabaseAdmin
        .from('banned_users')
        .insert({ email: email, reason: reason, banned_by: user.id });
       if (banError) throw banError;

       // Delete from Auth
       const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
       if (deleteError) throw deleteError;
       
       logEntry = {
        action_type: 'BAN_USER',
        resource_type: 'auth',
        details: { target_email: email, reason }
      };
    }

    else if (action === 'unban_user') {
        const { error } = await supabaseAdmin.from('banned_users').delete().eq('email', email);
        if (error) throw error;
        
        logEntry = {
            action_type: 'UNBAN_USER',
            resource_type: 'auth',
            details: { target_email: email }
        };
    }

    else if (action === 'update_position') {
        const { error } = await supabaseAdmin
            .from('profiles')
            .update({ position: targetPosition })
            .eq('id', userId);
        if (error) throw error;
        
        logEntry = {
            action_type: 'UPDATE_POSITION',
            resource_type: 'profile',
            resource_id: userId,
            details: { new_position: targetPosition }
        };
    }

    else if (action === 'admin_reset_password') {
        if (!newPassword || newPassword.length < 6) throw new Error("Password too short");
        
        const { error } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            { password: newPassword }
        );
        if (error) throw error;
        
        await supabaseAdmin.from('profiles').update({ has_password: true }).eq('id', userId);
        
        logEntry = {
            action_type: 'RESET_PASSWORD',
            resource_type: 'auth',
            resource_id: userId,
            details: { admin_action: true }
        };
    }
    
    else {
        throw new Error('Invalid action');
    }

    // 5. Log to DB
    if (logEntry) {
        await supabaseAdmin.from('activity_logs').insert({
            user_id: user.id,
            action_type: logEntry.action_type,
            resource_type: logEntry.resource_type,
            resource_id: logEntry.resource_id,
            details: logEntry.details
        });
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});