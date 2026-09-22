/**
 * 4-Point Spacing Scale
 */

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  huge: 40,

  // Semantic layout spacing
  screenHorizontal: 20,
  cardPadding: 16,
  cardPaddingLarge: 20,
  sectionGap: 24,
  inputHeight: 48,
  buttonHeight: 50,
  touchTargetMin: 44,
} as const;

export type SpacingToken = keyof typeof spacing;
