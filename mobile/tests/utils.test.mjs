import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatMoney,
  paiseToInputString,
  parseRupeesToPaise,
} from '../src/utils/money.ts';

import {
  decodeOutingQR,
  encodeOutingQR,
} from '../src/utils/qr.ts';

import {
  buildUpiPaymentUri,
  buildUpiQrPayload,
  formatUpiAmount,
  validateUpiId,
} from '../src/utils/upi.ts';

import {
  deriveWebSocketUrl,
} from '../src/utils/realtimeUrl.ts';

import {
  validateDisplayName,
  validateJoinCode,
  validatePassword,
  validateUsername,
} from '../src/utils/validation.ts';

import {
  AppError,
  getFriendlyErrorMessage,
  parseApiError,
} from '../src/lib/errors.ts';

describe('Money Utilities', () => {
  it('formats minor units to rupees with Indian grouping and INR symbol', () => {
    assert.equal(formatMoney(0), '₹0');
    assert.equal(formatMoney(1), '₹0.01');
    assert.equal(formatMoney(10), '₹0.10');
    assert.equal(formatMoney(100), '₹1');
    assert.equal(formatMoney(105), '₹1.05');
    assert.equal(formatMoney(150), '₹1.50');
    assert.equal(formatMoney(10000), '₹100');
    assert.equal(formatMoney(99999), '₹999.99');
    assert.equal(formatMoney(100000), '₹1,000');
    assert.equal(formatMoney(240000), '₹2,400');
    assert.equal(formatMoney(10000000), '₹1,00,000');
  });

  it('formats decimals conditionally based on options', () => {
    assert.equal(formatMoney(10000, { showDecimalIfZero: true }), '₹100.00');
    assert.equal(formatMoney(10050, { showDecimalIfZero: false }), '₹100.50');
    assert.equal(formatMoney(0, { showDecimalIfZero: true }), '₹0.00');
  });

  it('parses rupee string inputs to integer minor paise units', () => {
    assert.equal(parseRupeesToPaise('0'), 0);
    assert.equal(parseRupeesToPaise('0.01'), 1);
    assert.equal(parseRupeesToPaise('0.1'), 10);
    assert.equal(parseRupeesToPaise('0.10'), 10);
    assert.equal(parseRupeesToPaise('1'), 100);
    assert.equal(parseRupeesToPaise('1.05'), 105);
    assert.equal(parseRupeesToPaise('1.5'), 150);
    assert.equal(parseRupeesToPaise('1.50'), 150);
    assert.equal(parseRupeesToPaise('0.05'), 5);
    assert.equal(parseRupeesToPaise('999.99'), 99999);
    assert.equal(parseRupeesToPaise('1,000'), 100000);
    assert.equal(parseRupeesToPaise('2400'), 240000);
    assert.equal(parseRupeesToPaise('  2400.00  '), 240000);
    assert.equal(parseRupeesToPaise('1,00,000'), 10000000);
    assert.equal(parseRupeesToPaise('-50'), 0);
    assert.equal(parseRupeesToPaise('abc'), 0);
  });

  it('converts minor paise units to clean input strings', () => {
    assert.equal(paiseToInputString(0), '');
    assert.equal(paiseToInputString(1), '0.01');
    assert.equal(paiseToInputString(10), '0.10');
    assert.equal(paiseToInputString(100), '1');
    assert.equal(paiseToInputString(105), '1.05');
    assert.equal(paiseToInputString(150), '1.50');
    assert.equal(paiseToInputString(99999), '999.99');
    assert.equal(paiseToInputString(240000), '2400');
  });
});

describe('QR Utilities', () => {
  it('encodes outing payload into versioned JSON string', () => {
    const json = encodeOutingQR('7K4P9X', 'Friday Dinner');
    const parsed = JSON.parse(json);

    assert.equal(parsed.type, 'friend-ledger-outing');
    assert.equal(parsed.version, 1);
    assert.equal(parsed.join_code, '7K4P9X');
    assert.equal(parsed.name, 'Friday Dinner');
  });

  it('decodes valid versioned QR JSON string', () => {
    const raw = JSON.stringify({
      type: 'friend-ledger-outing',
      version: 1,
      join_code: '7k4p9x',
      name: 'Dinner',
    });

    const decoded = decodeOutingQR(raw);
    assert.ok(decoded);
    assert.equal(decoded.join_code, '7K4P9X');
    assert.equal(decoded.name, 'Dinner');
  });

  it('decodes raw 6-character uppercase join code as fallback', () => {
    const decoded = decodeOutingQR('7K4P9X');
    assert.ok(decoded);
    assert.equal(decoded.join_code, '7K4P9X');
    assert.equal(decoded.name, null);
  });

  it('rejects invalid or corrupted QR strings', () => {
    assert.equal(decodeOutingQR(''), null);
    assert.equal(decodeOutingQR('https://google.com'), null);
    assert.equal(decodeOutingQR('ABC'), null);
    assert.equal(decodeOutingQR(JSON.stringify({ type: 'other-app' })), null);
  });
});

describe('Validation Utilities', () => {
  it('validates display name', () => {
    assert.ok(validateDisplayName(''));
    assert.ok(validateDisplayName('A'));
    assert.equal(validateDisplayName('Arif Ali'), null);
  });

  it('validates username', () => {
    assert.ok(validateUsername(''));
    assert.ok(validateUsername('ab'));
    assert.ok(validateUsername('user name with spaces'));
    assert.ok(validateUsername('user@special!'));
    assert.equal(validateUsername('arif_ali'), null);
    assert.equal(validateUsername('Sameer123'), null);
  });

  it('validates password', () => {
    assert.ok(validatePassword(''));
    assert.ok(validatePassword('short'));
    assert.equal(validatePassword('pass12345'), null);
  });

  it('validates 6-character join code', () => {
    assert.ok(validateJoinCode(''));
    assert.ok(validateJoinCode('12345'));
    assert.ok(validateJoinCode('1234567'));
    assert.equal(validateJoinCode('7K4P9X'), null);
  });
});

describe('Error Handling & Mapping', () => {
  it('maps known AppError codes to friendly messages', () => {
    const err = new AppError('INVALID_CREDENTIALS', 'Backend message', 401);
    assert.equal(getFriendlyErrorMessage(err), 'Incorrect username or password.');

    const err2 = new AppError('SETTLEMENT_EXCEEDS_DEBT', 'Backend message', 409);
    assert.equal(
      getFriendlyErrorMessage(err2),
      'Settlement amount cannot exceed the current outstanding debt.'
    );
  });

  it('parses structured backend API error responses', () => {
    const apiJson = {
      error: {
        code: 'USERNAME_TAKEN',
        message: 'Username already in use',
      },
      request_id: 'req-123',
    };

    const parsed = parseApiError(409, apiJson);
    assert.equal(parsed.code, 'USERNAME_TAKEN');
    assert.equal(parsed.message, 'This username is already taken. Please choose another.');
    assert.equal(parsed.status, 409);
  });

  it('handles network abort and unexpected error fallbacks', () => {
    const networkErr = new Error('Network request failed');
    assert.match(getFriendlyErrorMessage(networkErr), /connect to Friend Ledger/);

    const failedToFetch = new TypeError('Failed to fetch');
    assert.equal(
      getFriendlyErrorMessage(failedToFetch),
      "Couldn't connect to Friend Ledger. Check your network or development server."
    );

    const loadFailed = new TypeError('Load failed');
    assert.equal(
      getFriendlyErrorMessage(loadFailed),
      "Couldn't connect to Friend Ledger. Check your network or development server."
    );

    const networkErrorFirefox = new Error('NetworkError when attempting to fetch resource.');
    assert.equal(
      getFriendlyErrorMessage(networkErrorFirefox),
      "Couldn't connect to Friend Ledger. Check your network or development server."
    );

    const unknownErr = new Error('Random string');
    assert.equal(getFriendlyErrorMessage(unknownErr), 'Something went wrong. Please try again.');
  });
});

describe('UPI Utilities', () => {
  it('formats minor units (paise) to exact decimal INR string without float rounding drift', () => {
    assert.equal(formatUpiAmount(0), '0.00');
    assert.equal(formatUpiAmount(1), '0.01');
    assert.equal(formatUpiAmount(10), '0.10');
    assert.equal(formatUpiAmount(100), '1.00');
    assert.equal(formatUpiAmount(105), '1.05');
    assert.equal(formatUpiAmount(50000), '500.00');
    assert.equal(formatUpiAmount(99999), '999.99');
    assert.equal(formatUpiAmount(10000000), '100000.00');
    assert.equal(formatUpiAmount(-100), '0.00');
  });

  it('validates UPI ID format and rejects invalid VPAs', () => {
    // Valid cases
    assert.equal(validateUpiId('friend@okaxis'), null);
    assert.equal(validateUpiId('user.name@oksbi'), null);
    assert.equal(validateUpiId('merchant-store@icici'), null);
    assert.equal(validateUpiId('user_99@paytm'), null);

    // Required / empty checks
    assert.ok(validateUpiId(''));
    assert.ok(validateUpiId('   '));
    assert.ok(validateUpiId(null));
    assert.ok(validateUpiId(undefined));

    // Whitespace checks
    assert.match(validateUpiId('user @okaxis') || '', /cannot contain spaces/);
    assert.match(validateUpiId('user@ okaxis') || '', /cannot contain spaces/);
    assert.match(validateUpiId('user name@okhdfc') || '', /cannot contain spaces/);

    // @ symbol counts
    assert.match(validateUpiId('userwithoutat') || '', /must contain exactly one @ symbol/);
    assert.match(validateUpiId('user@@bank') || '', /must contain exactly one @ symbol/);
    assert.match(validateUpiId('user@bank@other') || '', /must contain exactly one @ symbol/);

    // Character set & format
    assert.match(validateUpiId('user!@bank') || '', /Invalid UPI ID format/);
    assert.match(validateUpiId('user#@bank') || '', /Invalid UPI ID format/);
    assert.match(validateUpiId('a@b') || '', /Invalid UPI ID format/);
    assert.match(validateUpiId('ab') || '', /must be between 3 and 128 characters/);
  });

  it('builds standardized upi://pay URI with encoded parameters', () => {
    const uri = buildUpiPaymentUri({
      payeeUpiId: 'friend@okaxis',
      payeeName: 'John Doe',
      amountMinor: 25050,
      transactionNote: 'Dinner share',
      transactionRef: 'ref-9988',
    });

    assert.ok(uri.startsWith('upi://pay?'));
    const url = new URL(uri);
    assert.equal(url.searchParams.get('pa'), 'friend@okaxis');
    assert.equal(url.searchParams.get('pn'), 'John Doe');
    assert.equal(url.searchParams.get('am'), '250.50');
    assert.equal(url.searchParams.get('cu'), 'INR');
    assert.equal(url.searchParams.get('tn'), 'Dinner share');
    assert.equal(url.searchParams.get('tr'), 'ref-9988');
  });

  it('builds UPI QR payload identical to payment URI and uses default note', () => {
    const payload = buildUpiQrPayload({
      payeeUpiId: 'merchant@upi',
      payeeName: 'Cafe Coffee Day & Tea',
      amountMinor: 50000,
    });

    const url = new URL(payload);
    assert.equal(url.searchParams.get('pa'), 'merchant@upi');
    assert.equal(url.searchParams.get('pn'), 'Cafe Coffee Day & Tea');
    assert.equal(url.searchParams.get('am'), '500.00');
    assert.equal(url.searchParams.get('cu'), 'INR');
    assert.equal(url.searchParams.get('tn'), 'Friend Ledger settlement');
    assert.equal(url.searchParams.get('tr'), null);
  });
});

describe('Realtime URL Derivation', () => {
  it('converts development http to ws', () => {
    const wsUrl = deriveWebSocketUrl('http://127.0.0.1:8000', 'ticket123');
    assert.equal(wsUrl, 'ws://127.0.0.1:8000/api/v1/realtime/ws?ticket=ticket123');
  });

  it('converts development http with trailing slash to ws without double slash', () => {
    const wsUrl = deriveWebSocketUrl('http://localhost:8000/', 'ticket123');
    assert.equal(wsUrl, 'ws://localhost:8000/api/v1/realtime/ws?ticket=ticket123');
  });

  it('converts production https to secure wss', () => {
    const wsUrl = deriveWebSocketUrl('https://api.friendledger.com', 'ticket-abc');
    assert.equal(wsUrl, 'wss://api.friendledger.com/api/v1/realtime/ws?ticket=ticket-abc');
  });

  it('converts production https with trailing slash to wss', () => {
    const wsUrl = deriveWebSocketUrl('https://api.friendledger.com/', 'ticket-abc');
    assert.equal(wsUrl, 'wss://api.friendledger.com/api/v1/realtime/ws?ticket=ticket-abc');
  });

  it('encodes special characters in realtime ticket parameter', () => {
    const wsUrl = deriveWebSocketUrl('https://api.friendledger.com', 'tok+en/123==');
    assert.equal(wsUrl, 'wss://api.friendledger.com/api/v1/realtime/ws?ticket=tok%2Ben%2F123%3D%3D');
  });
});


