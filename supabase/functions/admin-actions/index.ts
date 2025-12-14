// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const getAllowedOrigin = (req: Request) => {
  const origin = req.headers.get('Origin');
  const allowedOriginsStr = Deno.env.get('ALLOWED_ORIGINS') || '*';
  if (allowedOriginsStr === '*') return '*';
  const allowedOrigins = allowedOriginsStr.split(',').map(u => u.trim());
  return origin && allowedOrigins.includes(origin) ? origin : null;
};

serve(async (req) => {
  const allowedOrigin = getAllowedOrigin(req);
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin || '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (!allowedOrigin) return new Response("CORS Not Allowed", { status: 403 });

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Verify Admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') throw new Error('Forbidden: Admins only');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, email, userId, reason } = await req.json();

    if (action === 'invite') {
      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'approve_user') {
       const { error } = await supabaseAdmin
        .from('profiles')
        .update({ is_approved: true })
        .eq('id', userId);
       if (error) throw error;
       return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'deny_ban_user') {
       // 1. Add to ban table
       const { error: banError } = await supabaseAdmin
        .from('banned_users')
        .insert({ email: email, reason: reason, banned_by: user.id });
       
       if (banError) throw banError;

       // 2. Delete the user from Auth (this cascades to profile delete usually, but we want to ensure they are gone)
       const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
       if (deleteError) throw deleteError;

       return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'unban_user') {
        const { error } = await supabaseAdmin.from('banned_users').delete().eq('email', email);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'reset_password') {
        const { data, error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
            redirectTo: `${req.headers.get('origin')}/update-password`
        });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'delete_user') {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    throw new Error('Invalid action');

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});