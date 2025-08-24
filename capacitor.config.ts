
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.thelegacyphotography.photomanager',
  appName: 'Photography Manager',
  webDir: 'public',
  server: {
    androidScheme: 'https',
    hostname: '8b52078f-2876-41ad-b7b4-15cd08bb6e7e-00-26t6e4y6vz596.worf.replit.dev',
    allowNavigation: [
      'https://photoshcheduleapp.firebaseapp.com',
      'https://*.replit.dev',
      'https://*.firebaseapp.com',
      'https://*.googleapis.com',
      'https://accounts.google.com',
      'https://www.googleapis.com',
      'https://8b52078f-2876-41ad-b7b4-15cd08bb6e7e-00-26t6e4y6vz596.worf.replit.dev'
    ]
  },
  ios: {
    scheme: 'photomanager',
    contentInset: 'automatic',
    allowsLinkPreview: false,
    handleApplicationNotifications: false,
    webContentsDebuggingEnabled: false
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
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
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      spinnerColor: '#999999'
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#000000'
    },
    Keyboard: {
      resizeOnFullScreen: true
    }
  }
};

export default config;
