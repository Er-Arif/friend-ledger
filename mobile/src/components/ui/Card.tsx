import React from 'react';
import { StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors } from '../../constants/colors';
import { radius } from '../../constants/radius';
import { spacing } from '../../constants/spacing';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  variant?: 'default' | 'iOwe' | 'owedToMe' | 'muted';
  accessibilityLabel?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  variant = 'default',
  accessibilityLabel,
}) => {
  const cardStyle = [
    styles.base,
    variant === 'default' && styles.default,
    variant === 'iOwe' && styles.iOwe,
    variant === 'owedToMe' && styles.owedToMe,
    variant === 'muted' && styles.muted,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={cardStyle}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.card,
    padding: spacing.cardPadding,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  default: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  iOwe: {
    backgroundColor: colors.iOweBg,
    borderColor: colors.iOweBorder,
  },
  owedToMe: {
    backgroundColor: colors.owedToMeBg,
    borderColor: colors.owedToMeBorder,
  },
  muted: {
    backgroundColor: colors.surfaceSecondary,
    borderColor: colors.borderMuted,
  },
});
