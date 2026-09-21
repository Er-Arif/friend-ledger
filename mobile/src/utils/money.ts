/**
 * Money utilities using integer minor units (paise).
 * Avoids floating point accumulation errors.
 * 100 paise = 1 INR
 */

/**
 * Formats minor units (paise) into human-readable INR string.
 * Examples:
 * - 50000 -> "₹500"
 * - 50050 -> "₹500.50"
 * - 0 -> "₹0"
 * - -15000 -> "₹150" (absolute value; direction handled separately)
 */
export function formatMoney(amountMinor: number, options?: { showDecimalIfZero?: boolean; absolute?: boolean }): string {
  const minor = options?.absolute !== false ? Math.abs(amountMinor) : amountMinor;
  const major = Math.floor(minor / 100);
  const remainingPaise = minor % 100;

  // Indian number formatting for major units
  const majorFormatted = major.toLocaleString('en-IN');

  if (remainingPaise === 0 && !options?.showDecimalIfZero) {
    return `₹${majorFormatted}`;
  }

  const paiseFormatted = remainingPaise.toString().padStart(2, '0');
  return `₹${majorFormatted}.${paiseFormatted}`;
}

/**
 * Parses user input rupee string into integer paise.
 * Examples:
 * - "500" -> 50000
 * - "500.5" -> 50050
 * - "500.50" -> 50050
 * - "0" -> 0
 * - "" -> 0
 * - invalid string -> 0
 */
export function parseRupeesToPaise(input: string): number {
  if (!input) return 0;
  if (input.trim().startsWith('-')) return 0;

  // Clean non-numeric characters except single decimal point
  const cleaned = input.replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;

  const parts = cleaned.split('.');
  const wholePart = parts[0] ? parseInt(parts[0], 10) : 0;

  if (isNaN(wholePart)) return 0;

  let fractionPart = 0;
  if (parts.length > 1 && parts[1]) {
    // Take at most 2 digits, pad with 0 if 1 digit
    const fractionStr = parts[1].slice(0, 2).padEnd(2, '0');
    fractionPart = parseInt(fractionStr, 10);
    if (isNaN(fractionPart)) fractionPart = 0;
  }

  return wholePart * 100 + fractionPart;
}

/**
 * Converts minor units back to input string format for editing.
 * Example: 50050 -> "500.50", 50000 -> "500"
 */
export function paiseToInputString(paise: number): string {
  if (paise <= 0) return '';
  const major = Math.floor(paise / 100);
  const rem = paise % 100;
  if (rem === 0) return major.toString();
  return `${major}.${rem.toString().padStart(2, '0')}`;
}
