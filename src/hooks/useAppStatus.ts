import { useEffect, useState, useCallback } from "react";
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
      // Handle build number parsing carefully as it can vary by platform config
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
    const env = getEnvironment();
    const platform = getPlatform();
    
    // Fetch matching status rows
    const { data, error } = await supabase
      .from('app_statuses')
      .select('*')
      .eq('environment', env)
      .in('platform', ['any', platform]);

    if (error) {
      console.error("Failed to fetch app status", error);
      // Don't block app on error, assume safe
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

    // Prioritize specific platform over 'any'
    const specific = data.find(d => d.platform === platform);
    const generic = data.find(d => d.platform === 'any');
    const effectiveStatus = (specific || generic) as AppStatus;

    const updateNeeded = await checkVersion(effectiveStatus);

    // Detect lifting of maintenance mode to trigger sync
    setState(prev => {
        if (!prev.loading && prev.isMaintenance && !effectiveStatus.is_maintenance) {
            console.log("Maintenance lifted! Triggering full re-sync...");
            queryClient.clear(); 
            refreshAll();
        }
        return {
            isMaintenance: effectiveStatus.is_maintenance,
            isUpdateRequired: updateNeeded,
            statusData: effectiveStatus,
            loading: false
        };
    });
  }, [queryClient, refreshAll]);

  useEffect(() => {
    fetchStatus();

    // 1. Realtime Subscription
    const channel = supabase
      .channel('app_status_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_statuses' },
        () => {
          console.log("App status update received via Realtime");
          fetchStatus();
        }
      )
      .subscribe();

    // 2. Window Focus / Visibility Listener (Catch-up mechanism)
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
    };
  }, [fetchStatus]);

  return state;
};