import { parseApiError } from './errors';
import { clearTokens, getTokens, setTokens } from './storage';
import { TokenPairResponse } from '../types/api';

/**
 * Centralized API Client for Friend Ledger
 */

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';

const REQUEST_TIMEOUT_MS = 15000;

export interface RequestOptions {
  headers?: Record<string, string>;
  idempotencyKey?: string;
  skipAuth?: boolean;
  timeoutMs?: number;
}

// Global auth failure callback to disconnect expired sessions
let onAuthFailureCallback: (() => void) | null = null;

export function registerAuthFailureHandler(callback: () => void): void {
  onAuthFailureCallback = callback;
}

// Refresh token deduplication queue
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const { refreshToken } = await getTokens();
      if (!refreshToken) {
        await clearTokens();
        onAuthFailureCallback?.();
        return null;
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        await clearTokens();
        onAuthFailureCallback?.();
        return null;
      }

      const data = (await response.json()) as TokenPairResponse;
      await setTokens(data.access_token, data.refresh_token);
      return data.access_token;
    } catch {
      await clearTokens();
      onAuthFailureCallback?.();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback if crypto.randomUUID fails
    }
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function request<T>(
  endpoint: string,
  method: string,
  body?: unknown,
  options?: RequestOptions,
  isRetry = false
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options?.headers || {}),
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options?.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  if (!options?.skipAuth) {
    const { accessToken } = await getTokens();
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options?.timeoutMs || REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as unknown as T;
    }

    // Handle 401 Unauthorized with single token refresh retry
    if (response.status === 401 && !options?.skipAuth && !isRetry) {
      const newAccessToken = await refreshAccessToken();
      if (newAccessToken) {
        return request<T>(endpoint, method, body, options, true);
      }
    }

    let json: unknown = null;
    const text = await response.text();
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        // Not JSON
      }
    }

    if (!response.ok) {
      throw parseApiError(response.status, json);
    }

    return json as T;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export const api = {
  get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, 'GET', undefined, options);
  },

  post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, 'POST', body, options);
  },

  delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, 'DELETE', undefined, options);
  },

  generateIdempotencyKey,
  getBaseUrl: () => API_BASE_URL,
};
