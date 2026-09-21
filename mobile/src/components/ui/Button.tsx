import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { colors } from '../../constants/colors';
import { radius } from '../../constants/radius';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'text' | 'destructive' | 'outline';
  size?: 'normal' | 'small' | 'large';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'normal',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  accessibilityLabel,
}) => {
  const isInteractive = !loading && !disabled;

  const buttonStyles = [
    styles.base,
    styles[variant],
    styles[size],
    disabled && styles.disabled,
    style,
  ];

  const textColor = {
    primary: colors.textInverse,
    secondary: colors.primary,
    text: colors.primary,
    destructive: colors.textInverse,
    outline: colors.textPrimary,
  }[variant];

  const textStyles = [
    styles.textBase,
    { color: disabled ? colors.textMuted : textColor },
    styles[`${size}Text`],
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={isInteractive ? onPress : undefined}
      disabled={!isInteractive}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'destructive' ? colors.textInverse : colors.primary}
        />
      ) : (
        <>
          {icon}
          <Text style={[textStyles, icon ? { marginLeft: spacing.sm } : null]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    minHeight: spacing.touchTargetMin,
  },
  primary: {
    backgroundColor: colors.primary,
    borderWidth: 0,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  text: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  destructive: {
    backgroundColor: colors.error,
    borderWidth: 0,
  },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  normal: {
    height: spacing.buttonHeight,
    paddingHorizontal: spacing.xl,
  },
  small: {
    height: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radius.input,
  },
  large: {
    height: 54,
    paddingHorizontal: spacing.xxl,
  },
  disabled: {
    opacity: 0.5,
    backgroundColor: colors.borderMuted,
    borderColor: 'transparent',
  },
  textBase: {
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
  },
  normalText: {
    fontSize: typography.size.base,
  },
  smallText: {
    fontSize: typography.size.sm,
  },
  largeText: {
    fontSize: typography.size.lg,
  },
});
