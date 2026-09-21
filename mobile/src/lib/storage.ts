import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Secure token storage using Expo SecureStore (with web localStorage fallback)
 */

const ACCESS_TOKEN_KEY = 'fl_access_token';
const REFRESH_TOKEN_KEY = 'fl_refresh_token';

export async function getTokens(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return {
          accessToken: window.localStorage.getItem(ACCESS_TOKEN_KEY),
          refreshToken: window.localStorage.getItem(REFRESH_TOKEN_KEY),
        };
      }
    } catch {
      return { accessToken: null, refreshToken: null };
    }
    return { accessToken: null, refreshToken: null };
  }

  try {
    const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    return { accessToken, refreshToken };
  } catch {
    return { accessToken: null, refreshToken: null };
  }
}

export async function setTokens(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      }
    } catch {
      console.warn('Failed to store authentication tokens in localStorage');
    }
    return;
  }

  try {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  } catch {
    // If SecureStore fails, log warning (do not leak token contents)
    console.warn('Failed to securely store authentication tokens');
  }
}

export async function clearTokens(): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(ACCESS_TOKEN_KEY);
        window.localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    } catch {
      // Ignore
    }
    return;
  }

  try {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    // Ignore errors during clearing
  }
}
