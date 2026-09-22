import { AppState } from 'react-native';
import { api } from './apiClient';
import { RealtimeEvent, RealtimeTicketResponse } from '../types/api';
import { useAuthStore } from '../stores/authStore';
import { deriveWebSocketUrl } from '../utils/realtimeUrl';

export { deriveWebSocketUrl };

const RECONNECT_INTERVALS_MS = [1000, 2000, 5000, 10000, 30000];

type RealtimeListener = (event: RealtimeEvent) => void;

class RealtimeService {
  private ws: WebSocket | null = null;
  private isExplicitlyClosed = false;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<RealtimeListener> = new Set();
  private appStateSubscribed = false;

  constructor() {
    this.setupAppStateListener();
  }

  private setupAppStateListener() {
    if (this.appStateSubscribed) return;
    this.appStateSubscribed = true;

    AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        // App returned to foreground: ensure connection is alive and trigger refresh
        if (useAuthStore.getState().isAuthenticated) {
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.connect();
          } else {
            // Signal a background recovery event so screens refresh potentially missed updates
            this.broadcastLocalEvent({ type: 'BALANCE_CHANGED' });
          }
        }
      }
    });
  }

  private getWsUrl(ticket: string): string {
    return deriveWebSocketUrl(api.getBaseUrl(), ticket);
  }

  public async connect(): Promise<void> {
    if (this.isConnecting) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (!useAuthStore.getState().isAuthenticated) {
      return;
    }

    this.isExplicitlyClosed = false;
    this.isConnecting = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      // 1. Obtain a short-lived WebSocket authentication ticket
      const { ticket } = await api.post<RealtimeTicketResponse>('/api/v1/realtime/ticket');

      // 2. Open WebSocket with ticket query parameter
      const wsUrl = this.getWsUrl(ticket);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        this.ws = ws;
        this.isConnecting = false;
        const wasReconnect = this.reconnectAttempts > 0;
        this.reconnectAttempts = 0;

        if (wasReconnect) {
          // Trigger data refresh upon successful reconnection
          this.broadcastLocalEvent({ type: 'BALANCE_CHANGED' });
        }
      };

      ws.onmessage = (e) => {
        try {
          const event: RealtimeEvent = JSON.parse(e.data);
          this.broadcastLocalEvent(event);
        } catch {
          // Ignore non-JSON messages (e.g. heartbeat pings)
        }
      };

      ws.onclose = () => {
        this.ws = null;
        this.isConnecting = false;
        if (!this.isExplicitlyClosed && useAuthStore.getState().isAuthenticated) {
          this.scheduleReconnect();
        }
      };

      ws.onerror = () => {
        this.ws = null;
        this.isConnecting = false;
      };
    } catch {
      this.isConnecting = false;
      if (!this.isExplicitlyClosed && useAuthStore.getState().isAuthenticated) {
        this.scheduleReconnect();
      }
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    const delay =
      RECONNECT_INTERVALS_MS[
        Math.min(this.reconnectAttempts, RECONNECT_INTERVALS_MS.length - 1)
      ];
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isExplicitlyClosed && useAuthStore.getState().isAuthenticated) {
        this.connect();
      }
    }, delay);
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = 0;
    this.isConnecting = false;
  }

  public subscribe(listener: RealtimeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private broadcastLocalEvent(event: RealtimeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Prevent listener errors from interfering with others
      }
    }
  }
}

export const realtime = new RealtimeService();
