// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Initialize Client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 2. Verify Admin Status
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') throw new Error('Forbidden: Admins only');

    // 3. Initialize Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, email, userId, reason, newPassword, targetPosition } = await req.json();
    let logMessage = "";

    // --- ACTIONS ---

    if (action === 'invite') {
      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
      if (error) throw error;
      logMessage = `Admin invited user ${email}`;
    }

    else if (action === 'approve_user') {
       const { error } = await supabaseAdmin
        .from('profiles')
        .update({ is_approved: true })
        .eq('id', userId);
       if (error) throw error;
       logMessage = `Admin approved user ID ${userId}`;
    }

    else if (action === 'deny_ban_user') {
       // 1. Add to ban table
       const { error: banError } = await supabaseAdmin
        .from('banned_users')
        .insert({ email: email, reason: reason, banned_by: user.id });
       if (banError) throw banError;

       // 2. Delete the user from Auth
       const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
       if (deleteError) throw deleteError;
       
       logMessage = `Admin banned and deleted user ${email}`;
    }

    else if (action === 'unban_user') {
        const { error } = await supabaseAdmin.from('banned_users').delete().eq('email', email);
        if (error) throw error;
        logMessage = `Admin unbanned email ${email}`;
    }

    else if (action === 'delete_user') {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) throw error;
        logMessage = `Admin deleted user ID ${userId}`;
    }

    else if (action === 'update_position') {
        const { error } = await supabaseAdmin
            .from('profiles')
            .update({ position: targetPosition })
            .eq('id', userId);
        if (error) throw error;
        // No log needed for trivial update, or optional
    }

    else if (action === 'admin_reset_password') {
        if (!newPassword || newPassword.length < 6) throw new Error("Password too short");
        
        const { error } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            { password: newPassword }
        );
        if (error) throw error;
        
        // Also ensure has_password is true
        await supabaseAdmin.from('profiles').update({ has_password: true }).eq('id', userId);
        
        logMessage = `Admin reset password for user ID ${userId}`;
    }
    
    else {
        throw new Error('Invalid action');
    }

    // 4. Log the action
    if (logMessage) {
        await supabaseAdmin.from('app_logs').insert({
            category: 'AUTH',
            message: logMessage,
            user_id: user.id,
            details: { action, target: email || userId }
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