import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        // Ensure session persistence is enabled (default is true, but explicit is safer)
        persistSession: true,
        // Ensure automatic token refresh is enabled (default is true, but explicit is safer)
        autoRefreshToken: true,
        // If the user is inactive for a long time, we want the session to be refreshed 
        // when they return, rather than relying solely on the onAuthStateChange listener.
        detectSessionInUrl: true,
    }
});