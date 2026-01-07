// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Initialize Clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    // Client for verifying the caller's auth
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    })

    // Admin client for performing privileged actions
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // 2. Verify Caller Identity & Role
    const { data: { user: caller }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !caller) {
      throw new Error('Unauthorized: Invalid session')
    }

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (callerProfile?.role !== 'admin') {
      throw new Error('Forbidden: Admin access required')
    }

    // 3. Process Request
    const { action, userId, email, newPassword, reason } = await req.json()

    console.log(`Processing action: ${action} for target: ${userId || email} by admin: ${caller.id}`);

    let result = { success: true, message: '' };

    switch (action) {
      case 'delete_user_full': {
        // Full Deletion: Removes from auth.users (cascades to public.profiles)
        if (!userId) throw new Error('userId is required for deletion');
        
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) throw error;
        
        result.message = 'User account fully deleted (Auth & Profile)';
        break;
      }

      case 'ban_user_and_delete': {
        // Deny Logic: Add to ban table then delete account
        if (!email) throw new Error('Email is required for banning');
        if (!userId) throw new Error('User ID is required for cleanup');

        // Check if already banned to avoid duplicate key error
        const { data: existingBan } = await supabaseAdmin
            .from('banned_users')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (!existingBan) {
            const { error: banError } = await supabaseAdmin
            .from('banned_users')
            .insert({
                email: email,
                reason: reason || 'Access Denied by Admin',
                banned_by: caller.id,
                user_id: userId // Optional ref, though user will be deleted
            });
            if (banError) throw banError;
        }

        // Delete Auth Account
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (deleteError) throw deleteError;

        result.message = 'User banned and account deleted';
        break;
      }

      case 'invite_user': {
        if (!email) throw new Error('Email is required for invite');
        const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
        if (error) throw error;
        result.message = `Invitation sent to ${email}`;
        break;
      }

      case 'admin_reset_password': {
        if (!userId || !newPassword) throw new Error('UserId and Password required');
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: newPassword
        });
        if (error) throw error;
        
        // Update profile flag
        await supabaseAdmin.from('profiles').update({ has_password: true }).eq('id', userId);
        result.message = 'Password updated successfully';
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Edge Function Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})