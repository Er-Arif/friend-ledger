import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { radius } from '../../constants/radius';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';

interface StatusChipProps {
  status: 'ACTIVE' | 'CLOSED' | 'VOIDED' | 'FINISHED';
}

export const StatusChip: React.FC<StatusChipProps> = ({ status }) => {
  const isPositive = status === 'ACTIVE';
  const isNeutral = status === 'CLOSED' || status === 'FINISHED';
  const isDestructive = status === 'VOIDED';

  const containerStyle = [
    styles.chip,
    isPositive && styles.activeChip,
    isNeutral && styles.neutralChip,
    isDestructive && styles.voidedChip,
  ];

  const textStyle = [
    styles.text,
    isPositive && styles.activeText,
    isNeutral && styles.neutralText,
    isDestructive && styles.voidedText,
  ];

  const label = {
    ACTIVE: 'ACTIVE',
    CLOSED: 'ENDED',
    FINISHED: 'ENDED',
    VOIDED: 'VOIDED',
  }[status];

  return (
    <View style={containerStyle}>
      <Text style={textStyle}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  activeChip: {
    backgroundColor: colors.owedToMeBg,
  },
  neutralChip: {
    backgroundColor: colors.surfaceSecondary,
  },
  voidedChip: {
    backgroundColor: colors.iOweBg,
  },
  text: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.5,
  },
  activeText: {
    color: colors.owedToMe,
  },
  neutralText: {
    color: colors.textSecondary,
  },
  voidedText: {
    color: colors.iOwe,
  },
});
