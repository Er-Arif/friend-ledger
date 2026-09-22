/**
 * Realtime URL utilities for Friend Ledger.
 * Pure functions for WebSocket protocol derivation and URL construction.
 */

/**
 * Pure function to derive WebSocket URL from HTTP API base URL and ticket.
 * Correctly converts http -> ws (development) and https -> wss (production).
 */
export function deriveWebSocketUrl(httpBaseUrl: string, ticket: string): string {
  const cleanBase = httpBaseUrl.trim().replace(/\/+$/, '');
  const wsBase = cleanBase
    .replace(/^https:\/\//i, 'wss://')
    .replace(/^http:\/\//i, 'ws://');
  return `${wsBase}/api/v1/realtime/ws?ticket=${encodeURIComponent(ticket)}`;
}
