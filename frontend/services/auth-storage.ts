import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Login tokens are credentials, so on phones they go in the OS keychain
// (expo-secure-store). SecureStore doesn't exist on web, so fall back to
// localStorage there.
//
// The customer login and the developer-area login are kept separately, so
// using one never logs you out of the other.
const CUSTOMER_KEY = 'moneywing.authToken';
const DEV_KEY = 'moneywing.devToken';

async function save(key: string, token: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, token);
    return;
  }
  await SecureStore.setItemAsync(key, token);
}

async function load(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function clear(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

// Customer login
export const saveToken = (token: string) => save(CUSTOMER_KEY, token);
export const getToken = () => load(CUSTOMER_KEY);
export const clearToken = () => clear(CUSTOMER_KEY);

// Developer-area login
export const saveDevToken = (token: string) => save(DEV_KEY, token);
export const getDevToken = () => load(DEV_KEY);
export const clearDevToken = () => clear(DEV_KEY);
