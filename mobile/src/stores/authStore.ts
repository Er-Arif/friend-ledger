import { create } from 'zustand';
import { api, registerAuthFailureHandler } from '../lib/apiClient';
import { clearTokens, getTokens, setTokens } from '../lib/storage';
import { AuthResponse, LoginRequest, RegisterRequest, User } from '../types/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  initialize: () => Promise<void>;
  login: (payload: LoginRequest) => Promise<User>;
  register: (payload: RegisterRequest) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Automatically handle background 401 session expiry
  registerAuthFailureHandler(() => {
    set({ user: null, isAuthenticated: false });
  });

  return {
    user: null,
    isLoading: true,
    isAuthenticated: false,

    initialize: async () => {
      set({ isLoading: true });
      try {
        const { accessToken } = await getTokens();
        if (!accessToken) {
          set({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }

        // Fetch current authenticated user
        const user = await api.get<User>('/api/v1/me');
        set({ user, isAuthenticated: true, isLoading: false });
      } catch {
        // If restoring session failed and refresh failed, clear state
        await clearTokens();
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    },

    login: async (payload: LoginRequest) => {
      const response = await api.post<AuthResponse>('/api/v1/auth/login', payload, {
        skipAuth: true,
      });

      await setTokens(response.access_token, response.refresh_token);
      set({ user: response.user, isAuthenticated: true });
      return response.user;
    },

    register: async (payload: RegisterRequest) => {
      const response = await api.post<AuthResponse>('/api/v1/auth/register', payload, {
        skipAuth: true,
      });

      await setTokens(response.access_token, response.refresh_token);
      set({ user: response.user, isAuthenticated: true });
      return response.user;
    },

    logout: async () => {
      try {
        const { refreshToken } = await getTokens();
        if (refreshToken) {
          await api.post('/api/v1/auth/logout', { refresh_token: refreshToken });
        }
      } catch {
        // Ignore network errors on logout
      } finally {
        await clearTokens();
        set({ user: null, isAuthenticated: false });
      }
    },

    setUser: (user: User | null) => {
      set({ user, isAuthenticated: user !== null });
    },
  };
});
