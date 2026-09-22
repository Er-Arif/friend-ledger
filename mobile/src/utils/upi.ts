/**
 * UPI Utilities for Friend Ledger
 * Standardized UPI URI creation, amount formatting, and VPA validation.
 */

const UPI_REGEX = /^[a-zA-Z0-9.\-_]{2,100}@[a-zA-Z0-9.\-_]{2,50}$/;

/**
 * Validates a UPI ID / VPA.
 * Returns null if valid, or a descriptive error message if invalid.
 */
export function validateUpiId(upiId: string | null | undefined): string | null {
  if (!upiId) {
    return 'UPI ID is required.';
  }

  const trimmed = upiId.trim();
  if (!trimmed) {
    return 'UPI ID cannot be blank.';
  }

  if (/\s/.test(trimmed)) {
    return 'UPI ID cannot contain spaces.';
  }

  if (trimmed.length < 3 || trimmed.length > 128) {
    return 'UPI ID must be between 3 and 128 characters.';
  }

  const atCount = (trimmed.match(/@/g) || []).length;
  if (atCount !== 1) {
    return 'UPI ID must contain exactly one @ symbol.';
  }

  if (!UPI_REGEX.test(trimmed)) {
    return 'Invalid UPI ID format. Expected format: username@bank.';
  }

  return null;
}

/**
 * Converts backend integer minor units (paise) to an exact decimal INR string for UPI.
 * Does NOT use floating-point arithmetic to prevent rounding errors like 499.999999.
 *
 * Examples:
 * 1 paise -> "0.01"
 * 105 paise -> "1.05"
 * 50000 paise -> "500.00"
 * 99999 paise -> "999.99"
 * 10000000 paise -> "100000.00"
 */
export function formatUpiAmount(amountMinor: number): string {
  const paise = Math.max(0, Math.round(amountMinor));
  const rupees = Math.floor(paise / 100);
  const remainderPaise = paise % 100;
  return `${rupees}.${remainderPaise.toString().padStart(2, '0')}`;
}

export interface UpiPaymentUriOptions {
  payeeUpiId: string;
  payeeName: string;
  amountMinor: number;
  transactionNote?: string;
  transactionRef?: string;
}

/**
 * Builds a standardized, safe, URL-encoded upi://pay URI.
 */
export function buildUpiPaymentUri(options: UpiPaymentUriOptions): string {
  const { payeeUpiId, payeeName, amountMinor, transactionNote, transactionRef } = options;

  const params = new URLSearchParams();
  params.set('pa', payeeUpiId.trim());
  params.set('pn', payeeName.trim());
  params.set('am', formatUpiAmount(amountMinor));
  params.set('cu', 'INR');
  params.set('tn', (transactionNote || 'Friend Ledger settlement').trim());

  if (transactionRef) {
    params.set('tr', transactionRef.trim());
  }

  return `upi://pay?${params.toString()}`;
}

/**
 * Builds the payload string for a UPI payment QR code.
 */
export function buildUpiQrPayload(options: UpiPaymentUriOptions): string {
  return buildUpiPaymentUri(options);
}
