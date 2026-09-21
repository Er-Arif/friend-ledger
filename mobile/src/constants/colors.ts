/**
 * Friend Ledger Design System - Color Palette
 * Clean, calm, modern social utility palette with emerald brand and semantic debt indicators.
 */

export const colors = {
  // Brand Emerald
  primary: '#16A36A',
  primaryDark: '#118255',
  primaryLight: '#E8F7F0',

  // Surfaces & Backgrounds
  background: '#F7F8F6',
  surface: '#FFFFFF',
  surfaceSecondary: '#F2F4F1',
  border: '#E7EAE5',
  borderMuted: '#E4E8E5',

  // Typography
  textPrimary: '#171A18',
  textSecondary: '#68706B',
  textMuted: '#969D98',
  textInverse: '#FFFFFF',

  // Semantic: Owed to Me (Receiving money / positive)
  owedToMe: '#16875D',
  owedToMeBg: '#E8F7F0',
  owedToMeBorder: '#BDE6D3',

  // Semantic: I Owe (Paying money / debt)
  iOwe: '#D65A52',
  iOweBg: '#FCEDEA',
  iOweBorder: '#F5C6C0',

  // System states
  warning: '#D89026',
  warningBg: '#FFF7E6',
  error: '#C94747',
  errorBg: '#FDF0F0',
  success: '#16A36A',
  successBg: '#E8F7F0',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.45)',
  skeleton: '#E9EBE8',
} as const;

export type ColorToken = keyof typeof colors;
