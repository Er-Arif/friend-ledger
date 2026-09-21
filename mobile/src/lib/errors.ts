import type { ApiErrorResponse } from '../types/api';

/**
 * Structured AppError class for mobile application
 */
export class AppError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown> | null;

  constructor(code: string, message: string, status = 400, details?: Record<string, unknown> | null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Map backend error codes to clear, friendly user messages.
 */
const ERROR_MESSAGE_MAP: Record<string, string> = {
  INVALID_CREDENTIALS: 'Incorrect username or password.',
  USERNAME_TAKEN: 'This username is already taken. Please choose another.',
  AUTH_REQUIRED: 'Please sign in to continue.',
  TOKEN_INVALID: 'Your session has expired. Please sign in again.',
  TOKEN_EXPIRED: 'Your session has expired. Please sign in again.',
  ACCOUNT_DISABLED: 'This account has been disabled.',
  SESSION_CLOSED: 'This outing has already ended.',
  INVALID_JOIN_CODE: 'This outing code is invalid.',
  SESSION_NOT_FOUND: 'Outing not found.',
  ALREADY_ACTIVE_PARTICIPANT: 'You are already participating in this outing.',
  NOT_ACTIVE_PARTICIPANT: 'You are not currently active in this outing.',
  PARTICIPANT_NOT_ACTIVE: 'This person is no longer active in the outing.',
  SESSION_FINISH_NOT_ALLOWED: 'An outing can only be finished when you are the final active participant.',
  SESSION_JOIN_CONFLICT: 'Could not join due to a concurrent update. Please try again.',
  INVALID_SPLIT: 'Payment split amounts must equal the total amount exactly.',
  INVALID_SPLIT_TYPE: 'Invalid split method selected.',
  SPLIT_TOTAL_MISMATCH: 'Payment split amounts must equal the total amount exactly.',
  PAYMENT_NOT_FOUND: 'Payment not found.',
  PAYMENT_NOT_OWNED: 'Only the person who recorded this payment can manage it.',
  PAYMENT_VOID_FORBIDDEN: 'Only the person who recorded this payment can void it.',
  PAYMENT_ALREADY_VOIDED: 'This payment has already been voided.',
  NO_OUTSTANDING_DEBT: 'You do not currently owe this person.',
  SETTLEMENT_EXCEEDS_DEBT: 'Settlement amount cannot exceed the current outstanding debt.',
  SETTLEMENT_NOT_FOUND: 'Settlement not found.',
  SETTLEMENT_VOID_FORBIDDEN: 'Only the person who recorded this settlement can void it.',
  SETTLEMENT_ALREADY_VOIDED: 'This settlement has already been voided.',
  SETTLEMENT_SELF_NOT_ALLOWED: 'You cannot settle a balance with yourself.',
  IDEMPOTENCY_KEY_REUSED: 'This request key was already used with a different payment.',
  IDEMPOTENCY_REQUEST_IN_PROGRESS: 'A payment request is already being processed. Please wait a moment.',
  IDEMPOTENCY_CONFLICT: 'A concurrent request conflict occurred. Please retry.',
  VALIDATION_ERROR: 'Please check the information entered and try again.',
  RATE_LIMITED: 'Too many requests. Please slow down and try again shortly.',
  RESOURCE_NOT_FOUND: 'The requested resource was not found.',
  INTERNAL_ERROR: 'Something went wrong on the server. Please try again later.',
};

/**
 * Translates an API response error or JavaScript exception into a friendly user message.
 */
export function getFriendlyErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    if (ERROR_MESSAGE_MAP[error.code]) {
      return ERROR_MESSAGE_MAP[error.code];
    }
    if (error.message && !error.message.includes('[object') && !error.message.includes('Internal Server')) {
      return error.message;
    }
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.message.includes('network') || error.message.includes('Network')) {
      return "Couldn't connect to Friend Ledger. Check your internet connection.";
    }
  }

  return 'Something went wrong. Please try again.';
}

/**
 * Parses raw JSON error response from backend.
 */
export function parseApiError(responseStatus: number, json: unknown): AppError {
  if (json && typeof json === 'object' && 'error' in json) {
    const apiError = (json as ApiErrorResponse).error;
    if (apiError && typeof apiError.code === 'string') {
      const friendly = ERROR_MESSAGE_MAP[apiError.code] || apiError.message;
      return new AppError(apiError.code, friendly, responseStatus, apiError.details);
    }
  }

  const fallbackCode = responseStatus >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED';
  const fallbackMsg = ERROR_MESSAGE_MAP[fallbackCode] || 'Request failed. Please try again.';
  return new AppError(fallbackCode, fallbackMsg, responseStatus);
}
