import { createClient } from '@supabase/supabase-js';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Custom storage adapter for Capacitor (Native only)
const CapacitorStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const { value } = await Preferences.get({ key });
      return value;
    } catch (error) {
      console.warn('CapacitorStorage getItem error:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await Preferences.set({ key, value });
    } catch (error) {
      console.warn('CapacitorStorage setItem error:', error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await Preferences.remove({ key });
    } catch (error) {
      console.warn('CapacitorStorage removeItem error:', error);
    }
  },
};

// Determine if running on native device or web
const isNative = Capacitor.isNativePlatform();

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Use native storage for mobile (async), localStorage for web (sync/standard)
    storage: isNative ? CapacitorStorage : localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});