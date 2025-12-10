import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

/**
 * Universal Storage Adapter
 * - Native: Uses Capacitor Preferences (Async, Persistent on device)
 * - Web: Uses localStorage (Sync, Standard)
 */
export const storageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (isNative) {
      const { value } = await Preferences.get({ key });
      return value;
    }
    return localStorage.getItem(key);
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (isNative) {
      await Preferences.set({ key, value });
      return;
    }
    localStorage.setItem(key, value);
  },

  removeItem: async (key: string): Promise<void> => {
    if (isNative) {
      await Preferences.remove({ key });
      return;
    }
    localStorage.removeItem(key);
  }
};