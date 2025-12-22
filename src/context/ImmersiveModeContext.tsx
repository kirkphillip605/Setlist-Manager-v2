import React, { createContext, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import { NavigationBar } from '@capacitor/navigation-bar';
import { storageAdapter } from '@/lib/storageAdapter';

interface ImmersiveModeContextType {
  isImmersive: boolean;
  toggleImmersive: () => Promise<void>;
}

const ImmersiveModeContext = createContext<ImmersiveModeContextType | undefined>(undefined);

export const ImmersiveModeProvider = ({ children }: { children: React.ReactNode }) => {
  const [isImmersive, setIsImmersive] = useState(false);
  const [isNativeAndroid, setIsNativeAndroid] = useState(false);

  useEffect(() => {
    const checkPlatform = async () => {
      const platform = Capacitor.getPlatform();
      if (platform === 'android') {
        setIsNativeAndroid(true);
        // Load preference
        const savedState = await storageAdapter.getItem('immersive_mode');
        // Default to true for Android if not set
        const shouldBeImmersive = savedState === null ? true : savedState === 'true';
        
        setIsImmersive(shouldBeImmersive);
        applyImmersiveState(shouldBeImmersive);
      }
    };
    checkPlatform();
  }, []);

  const applyImmersiveState = async (active: boolean) => {
    if (Capacitor.getPlatform() !== 'android') return;

    try {
      if (active) {
        await StatusBar.hide();
        await NavigationBar.hide();
      } else {
        await StatusBar.show();
        await NavigationBar.show();
      }
    } catch (e) {
      console.warn("Immersive mode toggle failed", e);
    }
  };

  const toggleImmersive = async () => {
    if (!isNativeAndroid) return;
    const newState = !isImmersive;
    setIsImmersive(newState);
    await storageAdapter.setItem('immersive_mode', String(newState));
    await applyImmersiveState(newState);
  };

  return (
    <ImmersiveModeContext.Provider value={{ isImmersive, toggleImmersive }}>
      {children}
    </ImmersiveModeContext.Provider>
  );
};

export const useImmersiveMode = () => {
  const context = useContext(ImmersiveModeContext);
  if (context === undefined) {
    throw new Error('useImmersiveMode must be used within an ImmersiveModeProvider');
  }
  return context;
};