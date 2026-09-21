import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { PaymentRead } from '../types/api';
import { formatMoney } from '../utils/money';
import { formatTime } from '../utils/dates';
import { Card } from './ui/Card';
import { StatusChip } from './ui/StatusChip';

interface PaymentCardProps {
  payment: PaymentRead;
  currentUserId?: string;
  onPress: () => void;
}

export const PaymentCard: React.FC<PaymentCardProps> = ({
  payment,
  currentUserId,
  onPress,
}) => {
  const isVoided = payment.status === 'VOIDED';
  const isPayer = currentUserId === payment.payer.user_id;
  const payerName = isPayer ? 'You' : payment.payer.display_name;

  // Find current user's share if any
  const myShare = payment.shares.find((s) => s.user_id === currentUserId);

  return (
    <Card
      onPress={onPress}
      variant={isVoided ? 'muted' : 'default'}
      style={styles.card}
      accessibilityLabel={`${payment.description}, ${formatMoney(payment.total_amount_minor)}, paid by ${payerName}`}
    >
      <View style={styles.topRow}>
        <View style={styles.titleArea}>
          <Text
            style={[styles.description, isVoided && styles.voidedText]}
            numberOfLines={1}
          >
            {payment.description}
          </Text>
          <Text style={styles.subtext}>
            {payerName} paid {formatMoney(payment.total_amount_minor)} · {formatTime(payment.created_at)}
          </Text>
        </View>

        <View style={styles.rightArea}>
          <Text style={[styles.amount, isVoided && styles.voidedText]}>
            {formatMoney(payment.total_amount_minor)}
          </Text>
          {isVoided && <StatusChip status="VOIDED" />}
        </View>
      </View>

      {myShare && !isVoided && (
        <View style={styles.shareRow}>
          <Text style={styles.shareLabel}>Your share:</Text>
          <Text style={styles.shareValue}>{formatMoney(myShare.amount_minor)}</Text>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.base,
    marginBottom: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleArea: {
    flex: 1,
    marginRight: spacing.sm,
  },
  description: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  subtext: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginTop: 3,
  },
  rightArea: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  voidedText: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: 8,
    marginTop: spacing.sm,
  },
  shareLabel: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
  },
  shareValue: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
});
