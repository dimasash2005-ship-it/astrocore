import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.astrocore.app',
  appName: 'AstroCore',
  webDir: 'public',
  server: {
    url: 'https://astrocore-eight.vercel.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
