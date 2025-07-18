import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.photographer.scheduler',
  appName: 'Photography Scheduler',
  webDir: 'www',
  server: {
    url: 'http://localhost:5000',
    cleartext: true
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
    backgroundColor: '#ffffff'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#667eea',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'DARK'
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true
    },
    Camera: {
      permissions: ['camera', 'photos']
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
