import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { radius } from '../constants/radius';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { LedgerEntry } from '../types/api';
import { formatMoney } from '../utils/money';
import { formatDateTime } from '../utils/dates';

interface LedgerEntryRowProps {
  entry: LedgerEntry;
  onPress?: () => void;
}

export const LedgerEntryRow: React.FC<LedgerEntryRowProps> = ({ entry, onPress }) => {
  const isSettlement = entry.source_type === 'SETTLEMENT';
  const isOwedToMe = entry.direction === 'OWED_TO_ME';

  // Amount sign from current user's perspective
  const amountPrefix = isOwedToMe ? '+' : '-';
  const amountColor = isOwedToMe ? colors.owedToMe : colors.iOwe;

  const iconName = isSettlement
    ? ('checkmark-circle-outline' as const)
    : ('receipt-outline' as const);

  const iconColor = isSettlement ? colors.primary : colors.textSecondary;

  const content = (
    <View style={styles.container}>
      <View style={[styles.iconBox, { backgroundColor: isSettlement ? colors.primaryLight : colors.surfaceSecondary }]}>
        <Ionicons name={iconName} size={20} color={iconColor} />
      </View>

      <View style={styles.content}>
        <Text style={styles.description} numberOfLines={1}>
          {entry.description}
        </Text>
        <Text style={styles.metaText}>
          {isSettlement && entry.method ? `${entry.method} · ` : ''}
          {formatDateTime(entry.created_at)}
        </Text>
      </View>

      <View style={styles.amountBox}>
        <Text style={[styles.amount, { color: amountColor }]}>
          {amountPrefix}
          {formatMoney(entry.amount_minor)}
        </Text>
        <Text style={styles.directionLabel}>
          {isOwedToMe ? 'Owed to you' : 'You owe'}
        </Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${entry.description}, ${amountPrefix}${formatMoney(entry.amount_minor)}`}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
    marginRight: spacing.sm,
  },
  description: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  metaText: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  amountBox: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
  },
  directionLabel: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
});
