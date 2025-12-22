import { useEffect, useState } from "react";
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
    // You could add logic for 'staging' based on specific env vars if needed
  };

  const getPlatform = (): AppPlatform => {
    const plat = Capacitor.getPlatform();
    if (plat === 'ios') return 'ios';
    if (plat === 'android') return 'android';
    return 'web';
  };

  const checkVersion = async (status: AppStatus): Promise<boolean> => {
    // If update not required by flag, return false (no update needed)
    if (!status.requires_update) return false;

    // Web doesn't handle version codes strictly like native
    if (getPlatform() === 'web') return false; 

    try {
      const info = await App.getInfo();
      const currentBuild = parseInt(info.build); // Build number/Version Code
      
      // Check Build Code
      if (status.min_version_code && currentBuild < status.min_version_code) {
        return true; // Update IS required
      }
      
      return false;
    } catch (e) {
      console.warn("Failed to check app version", e);
      return false; // Fail safe
    }
  };

  const fetchStatus = async () => {
    const env = getEnvironment();
    const platform = getPlatform();
    
    // Logic: Try to find specific platform row first, fall back to 'any'
    // We fetch both potentially matching rows
    const { data, error } = await supabase
      .from('app_statuses')
      .select('*')
      .eq('environment', env)
      .in('platform', ['any', platform]);

    if (error) {
      console.error("Failed to fetch app status", error);
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    if (!data || data.length === 0) {
      // No config found, allow app to load
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

    // Detect transition from Maintenance -> Normal
    // Only if we were previously initialized and in maintenance
    if (!state.loading && state.isMaintenance && !effectiveStatus.is_maintenance) {
        console.log("Maintenance lifted! triggering re-sync...");
        // Nuke cache
        queryClient.clear(); 
        // Trigger sync
        refreshAll();
    }

    setState({
      isMaintenance: effectiveStatus.is_maintenance,
      isUpdateRequired: updateNeeded,
      statusData: effectiveStatus,
      loading: false
    });
  };

  useEffect(() => {
    fetchStatus();

    // Subscribe to changes
    const channel = supabase
      .channel('app_status_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_statuses' },
        () => {
          console.log("App status update received");
          fetchStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return state;
};