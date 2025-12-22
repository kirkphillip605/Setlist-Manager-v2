import React, { createContext, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import { NavigationBar } from '@capacitor/navigation-bar';

interface ImmersiveContextType {
  isImmersive: boolean;
  toggleImmersive: () => Promise<void>;
  enableImmersive: () => Promise<void>;
  disableImmersive: () => Promise<void>;
}

const ImmersiveContext = createContext<ImmersiveContextType | undefined>(undefined);

export const ImmersiveProvider = ({ children }: { children: React.ReactNode }) => {
  // Default to true on Native Android (since MainActivity forces it), false elsewhere
  const [isImmersive, setIsImmersive] = useState(() => {
    return Capacitor.getPlatform() === 'android';
  });

  const enableImmersive = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await StatusBar.hide();
      await NavigationBar.hide();
      setIsImmersive(true);
    } catch (e) {
      console.error("Failed to enable immersive mode", e);
    }
  };

  const disableImmersive = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await StatusBar.show();
      await NavigationBar.show();
      setIsImmersive(false);
    } catch (e) {
      console.error("Failed to disable immersive mode", e);
    }
  };

  const toggleImmersive = async () => {
    if (isImmersive) {
      await disableImmersive();
    } else {
      await enableImmersive();
    }
  };

  // Sync state on mount for Android
  useEffect(() => {
    if (Capacitor.getPlatform() === 'android') {
      // Re-enforce immersive mode on mount to ensure JS state matches Native state
      enableImmersive();
    }
  }, []);

  return (
    <ImmersiveContext.Provider value={{ isImmersive, toggleImmersive, enableImmersive, disableImmersive }}>
      {children}
    </ImmersiveContext.Provider>
  );
};

export const useImmersive = () => {
  const context = useContext(ImmersiveContext);
  if (context === undefined) {
    throw new Error('useImmersive must be used within an ImmersiveProvider');
  }
  return context;
};