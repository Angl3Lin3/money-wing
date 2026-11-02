import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// The JWT is a login credential, so on phones it goes in the OS keychain
// (expo-secure-store). SecureStore doesn't exist on web, so fall back to
// localStorage there.
const TOKEN_KEY = 'moneywing.authToken';

export async function saveToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
