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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, { 
      global: { headers: { Authorization: req.headers.get('Authorization')! } } 
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') throw new Error('Forbidden: Admins only');

    const { action, email, userId, newPassword } = await req.json();
    let message = "";

    switch (action) {
        case 'invite':
            if (!email) throw new Error("Email is required");
            const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
            if (inviteError) throw inviteError;
            message = `Invited ${email}`;
            break;

        case 'delete_user_auth':
            // Changed to SOFT DELETE logic: Ban user instead of deleting.
            if (!userId) throw new Error("User ID is required");
            
            // 1. Mark profile as inactive
            await supabaseAdmin.from('profiles').update({ is_active: false }).eq('id', userId);
            
            // 2. Ban in Auth (Revoke sessions and block login)
            const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
                ban_duration: "876000h" // ~100 years
            });
            
            if (banError) throw banError;
            message = `Deactivated and banned user ${userId}`;
            break;

        case 'admin_reset_password':
            if (!userId || !newPassword) throw new Error("User ID and Password required");
            if (newPassword.length < 6) throw new Error("Password too short");
            
            const { error: pwdError } = await supabaseAdmin.auth.admin.updateUserById(
                userId,
                { password: newPassword }
            );
            if (pwdError) throw pwdError;
            
            await supabaseAdmin.from('profiles').update({ has_password: true }).eq('id', userId);
            message = `Reset password for ${userId}`;
            break;

        default:
            throw new Error(`Invalid action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, message }), { 
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