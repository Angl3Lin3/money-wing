import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Where the app finds the backend.
//
// 1. If EXPO_PUBLIC_API_URL is set (frontend/.env), that address is used.
//    Use this for an online server, e.g. https://api.moneywingapp.com
// 2. On a phone running Expo Go, the app uses the same computer that is
//    serving the app (your Mac on the Wi-Fi), port 3000. Nothing to set up.
// 3. In a web browser, it uses the computer that served the page, port 3000
//    (http://localhost:3000 on this computer).
const BACKEND_PORT = 3000;

function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  if (Platform.OS !== 'web') {
    // e.g. "192.168.1.23:8081" -> the Mac's address on the Wi-Fi
    const hostUri: string | undefined =
      Constants.expoConfig?.hostUri ?? (Constants as any).expoGoConfig?.debuggerHost;
    const host = hostUri?.split(':')[0];
    if (host) return `http://${host}:${BACKEND_PORT}`;
  }

  // Web browser: use whichever computer served this page. That is localhost
  // on this computer, or the Mac's Wi-Fi address when the page is opened in
  // a phone's browser.
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:${BACKEND_PORT}`;
  }

  return `http://localhost:${BACKEND_PORT}`;
}

export const API_BASE_URL = resolveApiUrl();
