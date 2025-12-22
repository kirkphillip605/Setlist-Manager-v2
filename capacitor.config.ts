import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kirknetllc.setlistpro',
  appName: 'Setlist Manager Pro',
  webDir: 'dist',
    plugins: {
      StatusBar: {
        overlaysWebView: false,
        overlay: true,
        style: "DARK",
      },
    },
};

export default config;