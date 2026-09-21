/**
 * Versionable QR Code Payload Encoder and Decoder
 */

export interface FriendLedgerQRPayload {
  type: 'friend-ledger-outing';
  version: 1;
  join_code: string;
  name?: string | null;
}

export function encodeOutingQR(joinCode: string, outingName?: string | null): string {
  const payload: FriendLedgerQRPayload = {
    type: 'friend-ledger-outing',
    version: 1,
    join_code: joinCode.trim().toUpperCase(),
    name: outingName ? outingName.trim() : undefined,
  };

  return JSON.stringify(payload);
}

export function decodeOutingQR(rawText: string): { join_code: string; name?: string | null } | null {
  if (!rawText || typeof rawText !== 'string') return null;

  const trimmed = rawText.trim();

  // 1. Try parsing JSON payload
  try {
    const parsed = JSON.parse(trimmed);
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.type === 'friend-ledger-outing' &&
      typeof parsed.join_code === 'string'
    ) {
      const code = parsed.join_code.trim().toUpperCase();
      if (code.length >= 4 && code.length <= 10) {
        return {
          join_code: code,
          name: typeof parsed.name === 'string' ? parsed.name : null,
        };
      }
    }
  } catch {
    // Not a JSON payload, check for raw code
  }

  // 2. Direct raw join code fallback (alphanumeric 6 characters)
  const codeCandidate = trimmed.toUpperCase();
  if (/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/.test(codeCandidate)) {
    return {
      join_code: codeCandidate,
      name: null,
    };
  }

  return null;
}
