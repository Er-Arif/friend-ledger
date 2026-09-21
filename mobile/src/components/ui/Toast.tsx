import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { radius } from '../../constants/radius';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { useToastStore } from '../../stores/toastStore';

export const Toast: React.FC = () => {
  const { visible, message, type, hide } = useToastStore();

  if (!visible) return null;

  const iconName = {
    success: 'checkmark-circle',
    error: 'alert-circle',
    info: 'information-circle',
  }[type] as keyof typeof Ionicons.glyphMap;

  const iconColor = {
    success: colors.owedToMe,
    error: colors.error,
    info: colors.primary,
  }[type];

  const bgColor = {
    success: colors.owedToMeBg,
    error: colors.errorBg,
    info: colors.surface,
  }[type];

  const borderColor = {
    success: colors.owedToMeBorder,
    error: colors.error,
    info: colors.border,
  }[type];

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <TouchableOpacity
        style={[styles.container, { backgroundColor: bgColor, borderColor }]}
        onPress={hide}
        activeOpacity={0.9}
        accessibilityRole="alert"
      >
        <Ionicons name={iconName} size={22} color={iconColor} style={styles.icon} />
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    paddingHorizontal: spacing.lg,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: radius.card,
    borderWidth: 1,
    maxWidth: 400,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  icon: {
    marginRight: spacing.sm,
  },
  message: {
    flex: 1,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
});
