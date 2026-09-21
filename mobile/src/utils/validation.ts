/**
 * Validation utilities for user input
 */

export function validateDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'Name is required.';
  }
  if (trimmed.length < 2) {
    return 'Name must be at least 2 characters.';
  }
  if (trimmed.length > 80) {
    return 'Name cannot exceed 80 characters.';
  }
  return null;
}

export function validateUsername(username: string): string | null {
  const trimmed = username.trim();
  if (!trimmed) {
    return 'Username is required.';
  }
  if (trimmed.length < 3) {
    return 'Username must be at least 3 characters.';
  }
  if (trimmed.length > 30) {
    return 'Username cannot exceed 30 characters.';
  }
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return 'Username can only contain letters, numbers, and underscores.';
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) {
    return 'Password is required.';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  return null;
}

export function validateJoinCode(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) {
    return 'Join code is required.';
  }
  if (trimmed.length !== 6) {
    return 'Join code must be 6 characters.';
  }
  return null;
}
