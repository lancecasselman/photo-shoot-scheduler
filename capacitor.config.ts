
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourco.photoshootscheduler',
  appName: 'Photo Shoot Scheduler',
  webDir: 'public',
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
    allowNavigation: [
      'https://photoshcheduleapp.firebaseapp.com',
      'https://*.replit.dev',
      'https://*.firebaseapp.com'
    ]
  },
  ios: {
    scheme: 'photoshootscheduler',
    contentInset: 'automatic'
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    }
  },
  plugins: {
    Camera: {
      permissions: ['camera', 'photos']
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
