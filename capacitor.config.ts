
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.thelegacyphotography.photomanager',
  appName: 'Photography Manager',
  webDir: 'public',
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
    allowNavigation: [
      'https://photoshcheduleapp.firebaseapp.com',
      'https://*.replit.dev',
      'https://*.firebaseapp.com',
      'https://*.googleapis.com',
      'https://accounts.google.com',
      'https://www.googleapis.com'
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
    webContentsDebuggingEnabled: false,
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
      launchShowDuration: 2000,
      launchAutoHide: true,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      spinnerColor: '#999999'
    },
    StatusBar: {
      style: 'default',
      backgroundColor: '#000000'
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true
    }
  }
};

export default config;
