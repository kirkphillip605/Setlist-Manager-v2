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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error("Missing server-side configuration (Keys)");
    }

    // 2. Client Setup - User Context
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, { 
      global: { headers: { Authorization: req.headers.get('Authorization')! } } 
    });

    // 3. Client Setup - Admin Context
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Verify Requestor is Admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized: No user found');

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') throw new Error('Forbidden: Admins only');

    // 5. Parse Body
    let body;
    try {
        body = await req.json();
    } catch (e) {
        throw new Error("Invalid request body");
    }

    const { action, email, userId, reason, newPassword, targetPosition } = body;
    let logMessage = "";

    // --- EXECUTE ACTIONS ---

    if (action === 'invite') {
      if (!email) throw new Error("Email is required");
      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
      if (error) throw error;
      logMessage = `Admin invited user ${email}`;
    }

    else if (action === 'approve_user') {
       if (!userId) throw new Error("User ID is required");
       const { error } = await supabaseAdmin
        .from('profiles')
        .update({ is_approved: true })
        .eq('id', userId);
       if (error) throw error;
       logMessage = `Admin approved user ID ${userId}`;
    }

    else if (action === 'deny_ban_user') {
       if (!userId || !email) throw new Error("User ID and Email required");
       
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
        if (!email) throw new Error("Email required");
        const { error } = await supabaseAdmin.from('banned_users').delete().eq('email', email);
        if (error) throw error;
        logMessage = `Admin unbanned email ${email}`;
    }

    else if (action === 'update_position') {
        if (!userId) throw new Error("User ID required");
        const { error } = await supabaseAdmin
            .from('profiles')
            .update({ position: targetPosition })
            .eq('id', userId);
        if (error) throw error;
        logMessage = `Admin updated position for ${userId}`;
    }

    else if (action === 'admin_reset_password') {
        if (!userId || !newPassword) throw new Error("User ID and Password required");
        if (newPassword.length < 6) throw new Error("Password too short");
        
        const { error } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            { password: newPassword }
        );
        if (error) throw error;
        
        await supabaseAdmin.from('profiles').update({ has_password: true }).eq('id', userId);
        logMessage = `Admin reset password for user ID ${userId}`;
    }
    
    else {
        throw new Error(`Invalid action: ${action}`);
    }

    // 6. Log the action
    if (logMessage) {
        await supabaseAdmin.from('activity_logs').insert({
            user_id: user.id,
            action_type: action.toUpperCase(),
            resource_type: 'admin',
            resource_id: userId || email,
            details: { message: logMessage, target: email || userId }
        });
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    // Standardize error output to be a string message
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Edge Function Error:", errorMessage);
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});