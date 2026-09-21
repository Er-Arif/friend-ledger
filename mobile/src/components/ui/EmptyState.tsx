import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { Button } from './Button';

import { Ionicons } from '@expo/vector-icons';

interface EmptyStateProps {
  icon?: React.ReactNode | string;
  title: string;
  message?: string;
  description?: string;
  actionTitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  message,
  description,
  actionTitle,
  actionLabel,
  onAction,
  style,
}) => {
  const displayText = description || message;
  const buttonLabel = actionLabel || actionTitle;

  const renderIcon = () => {
    if (!icon) return null;
    if (typeof icon === 'string') {
      return <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={48} color={colors.textMuted} />;
    }
    return icon;
  };

  return (
    <View style={[styles.container, style]}>
      {icon && <View style={styles.iconContainer}>{renderIcon()}</View>}
      <Text style={styles.title}>{title}</Text>
      {displayText ? <Text style={styles.message}>{displayText}</Text> : null}
      {buttonLabel && onAction && (
        <Button
          title={buttonLabel}
          onPress={onAction}
          variant="primary"
          style={styles.actionButton}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  iconContainer: {
    marginBottom: spacing.base,
    opacity: 0.85,
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  message: {
    fontSize: typography.size.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
    marginBottom: spacing.xl,
  },
  actionButton: {
    minWidth: 160,
  },
});
