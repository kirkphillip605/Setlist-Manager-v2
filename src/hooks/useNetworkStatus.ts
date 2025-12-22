import { useState, useEffect } from 'react';
import { Network } from '@capacitor/network';
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from '@supabase/supabase-js';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true); // Default to true

  useEffect(() => {
    let mounted = true;
    let realtimeChannel: RealtimeChannel | null = null;

    const updateStatus = (connected: boolean) => {
      if (mounted) setIsOnline(connected);
    };

    // 1. Initialize Capacitor Network Listener
    const initNetwork = async () => {
      const status = await Network.getStatus();
      updateStatus(status.connected);

      Network.addListener('networkStatusChange', (status) => {
        console.log('Network status changed:', status);
        updateStatus(status.connected);
        
        // If we regained network, ensure realtime reconnects
        if (status.connected) {
            supabase.realtime.connect();
        }
      });
    };

    initNetwork();

    // 2. Monitor Realtime Connection
    // We use a system channel to track connection state changes
    const handleRealtimeStatus = (status: string) => {
        console.log('Realtime status:', status);
        if (status === 'SUBSCRIBED') {
            // We are definitely connected
            updateStatus(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            // We might be offline
            updateStatus(false);
        }
    };

    // Global Realtime Status
    // Supabase JS v2 exposes connection state
    const timer = setInterval(() => {
        if (!mounted) return;
        
        // If Capacitor says we are offline, trust it.
        // If Capacitor says we are online, verify with Realtime/Internet check
        Network.getStatus().then(status => {
            if (!status.connected) {
                updateStatus(false);
            } else {
                // Capacitor says connected, check Realtime
                const state = supabase.realtime.connectionState;
                // 'open' means connected. 'connecting' is ambiguous. 'closed' is offline.
                // We don't want to flap too much, but if it's closed while network is up, assume issues.
                if (state === 'closed') {
                    // Try to reconnect if we think we have internet
                    supabase.realtime.connect();
                }
            }
        });
    }, 5000);

    // Listen to specific channel events as a proxy for "Internet Access"
    // Since Capacitor only checks network interface, not actual internet.
    realtimeChannel = supabase.channel('_health_check');
    realtimeChannel.subscribe((status) => {
        handleRealtimeStatus(status);
    });

    return () => {
      mounted = false;
      clearInterval(timer);
      Network.removeAllListeners();
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    };
  }, []);

  return isOnline;
}