import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rrperformance.app',
  appName: 'RR Performance',
  webDir: 'out',
  server: {
    url: 'https://rr-performance.vercel.app',
    cleartext: true
  }
};

export default config;
