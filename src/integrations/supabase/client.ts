import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        // Persist the session in local storage (default)
        persistSession: true,
        // Automatically refresh the token before it expires
        autoRefreshToken: true,
        // Detect session in URL for OAuth redirects
        detectSessionInUrl: true,
        // Using 'local' storage is the default and correct for web
        storage: window.localStorage
    }
});