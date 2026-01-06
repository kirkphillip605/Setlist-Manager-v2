import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { AppStatus, AppPlatform } from "@/types/system";
import { useQueryClient } from "@tanstack/react-query";
import { useSyncStatus } from "./useSyncedData";

interface StatusState {
  isMaintenance: boolean;
  isUpdateRequired: boolean;
  statusData: AppStatus | null;
  loading: boolean;
}

export const useAppStatus = () => {
  const [state, setState] = useState<StatusState>({
    isMaintenance: false,
    isUpdateRequired: false,
    statusData: null,
    loading: true,
  });

  const queryClient = useQueryClient();
  const { refreshAll } = useSyncStatus();
  const lastFetchTime = useRef<number>(0);
  const fetchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Helper to determine environment
  const getEnvironment = (): string => {
    if (import.meta.env.PROD) return 'production';
    return 'development'; 
  };

  const getPlatform = (): AppPlatform => {
    const plat = Capacitor.getPlatform();
    if (plat === 'ios') return 'ios';
    if (plat === 'android') return 'android';
    return 'web';
  };

  const checkVersion = async (status: AppStatus): Promise<boolean> => {
    if (!status.requires_update) return false;
    if (getPlatform() === 'web') return false; 

    try {
      const info = await App.getInfo();
      const currentBuild = parseInt(info.build) || 0; 
      if (status.min_version_code && currentBuild < status.min_version_code) {
        return true;
      }
      return false;
    } catch (e) {
      console.warn("Failed to check app version", e);
      return false;
    }
  };

  const fetchStatus = useCallback(async () => {
    // Debounce: prevent fetching more than once every 10 seconds
    const now = Date.now();
    if (now - lastFetchTime.current < 10000) return;
    lastFetchTime.current = now;

    const env = getEnvironment();
    const platform = getPlatform();
    
    try {
        const { data, error } = await supabase
        .from('app_statuses')
        .select('*')
        .eq('environment', env)
        .in('platform', ['any', platform]);

        if (error) {
            // Silent fail to prevent log spam if offline
            setState(prev => ({ ...prev, loading: false }));
            return;
        }

        if (!data || data.length === 0) {
            setState({ 
                isMaintenance: false, 
                isUpdateRequired: false, 
                statusData: null, 
                loading: false 
            });
            return;
        }

        const specific = data.find(d => d.platform === platform);
        const generic = data.find(d => d.platform === 'any');
        const effectiveStatus = (specific || generic) as AppStatus;

        const updateNeeded = await checkVersion(effectiveStatus);

        setState(prev => {
            if (!prev.loading && prev.isMaintenance && !effectiveStatus.is_maintenance) {
                // Maintenance lifted
                refreshAll();
            }
            return {
                isMaintenance: effectiveStatus.is_maintenance,
                isUpdateRequired: updateNeeded,
                statusData: effectiveStatus,
                loading: false
            };
        });
    } catch (e) {
        // Catch network errors silently
        setState(prev => ({ ...prev, loading: false }));
    }
  }, [refreshAll]);

  useEffect(() => {
    fetchStatus();

    const channel = supabase
      .channel('app_status_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_statuses' },
        () => {
            // Debounce realtime updates too
            if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
            fetchTimeout.current = setTimeout(fetchStatus, 2000);
        }
      )
      .subscribe();

    const handleFocus = () => {
        if (document.visibilityState === 'visible') {
            fetchStatus();
        }
    };
    
    window.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('focus', handleFocus);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('focus', handleFocus);
      if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
    };
  }, [fetchStatus]);

  return state;
};