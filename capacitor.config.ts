import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.massivemagnetics.bandofiai',
  appName: 'Bando-Fi AI',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#000000',
      showSpinner: true,
      spinnerColor: '#39ff14'
    }
  },
  android: {
    buildOptions: {
      // Note: For production signed builds, set these via environment variables:
      // ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD
      // For unsigned builds (development), these can remain undefined
      keystorePath: process.env.ANDROID_KEYSTORE_PATH || undefined,
      keystorePassword: process.env.ANDROID_KEYSTORE_PASSWORD || undefined,
      keystoreAlias: process.env.ANDROID_KEY_ALIAS || undefined,
      keystoreAliasPassword: process.env.ANDROID_KEY_PASSWORD || undefined,
      releaseType: 'APK'
    }
  },
  ios: {
    contentInset: 'automatic',
    scheme: 'Bando-Fi AI'
  }
};

export default config;
