/**
 * Shape Language & Border Radii
 */

export const radius = {
  none: 0,
  sm: 8,
  input: 12,
  button: 14,
  card: 16,
  modal: 24,
  pill: 9999,
  full: 9999,
} as const;

export type RadiusToken = keyof typeof radius;
