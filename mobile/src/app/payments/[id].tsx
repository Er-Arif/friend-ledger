import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/ui/Screen';
import { AppHeader } from '../../components/ui/AppHeader';
import { StatusChip } from '../../components/ui/StatusChip';
import { Card } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { api } from '../../lib/apiClient';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import { PaymentRead } from '../../types/api';
import { getFriendlyErrorMessage } from '../../lib/errors';
import { formatDateTime } from '../../utils/dates';
import { formatMoney } from '../../utils/money';

export default function PaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const showToast = useToastStore((s) => s.show);

  const [payment, setPayment] = useState<PaymentRead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);

  const fetchPayment = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.get<PaymentRead>(`/api/v1/payments/${id}`);
      setPayment(res);
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      fetchPayment();
    }, [fetchPayment])
  );

  const handleVoidPayment = async () => {
    if (!id) return;
    setIsVoiding(true);

    try {
      const idempotencyKey = api.generateIdempotencyKey();
      const res = await api.post<PaymentRead>(
        `/api/v1/payments/${id}/void`,
        { reason: 'Voided by user' },
        { idempotencyKey }
      );
      setPayment(res);
      setShowVoidConfirm(false);
      showToast('Payment voided.', 'info');
    } catch (err) {
      setShowVoidConfirm(false);
      showToast(getFriendlyErrorMessage(err), 'error');
    } finally {
      setIsVoiding(false);
    }
  };

  if (isLoading && !payment) {
    return (
      <Screen>
        <LoadingState message="Loading payment details..." />
      </Screen>
    );
  }

  if (errorMessage && !payment) {
    return (
      <Screen>
        <ErrorState
          title="Could not load payment"
          message={errorMessage}
          onRetry={fetchPayment}
        />
      </Screen>
    );
  }

  if (!payment) return null;

  const isVoided = payment.status === 'VOIDED';
  const isPayer = user?.id === payment.payer.user_id;
  const payerName = isPayer ? 'You' : payment.payer.display_name;

  return (
    <Screen scrollable contentContainerStyle={styles.container}>
      <AppHeader
        title={payment.description}
        subtitle={formatDateTime(payment.created_at)}
        showBack
        rightAction={<StatusChip status={payment.status} />}
      />

      {/* Void Banner */}
      {isVoided && (
        <View style={styles.voidBanner}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.warning} />
          <View style={styles.voidBannerText}>
            <Text style={styles.voidBannerTitle}>This payment has been voided</Text>
            {payment.voided_at && (
              <Text style={styles.voidBannerSub}>
                Voided on {formatDateTime(payment.voided_at)}
                {payment.void_reason ? ` • "${payment.void_reason}"` : ''}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Main Total Card */}
      <Card style={styles.totalCard}>
        <Text style={styles.totalLabel}>TOTAL AMOUNT</Text>
        <Text style={[styles.totalAmount, isVoided && styles.voidedText]}>
          {formatMoney(payment.total_amount_minor)}
        </Text>
        <View style={styles.payerRow}>
          <Text style={styles.payerText}>Paid by </Text>
          <Text style={styles.payerName}>{payerName}</Text>
          <View style={styles.splitChip}>
            <Text style={styles.splitChipText}>
              {payment.split_type === 'EQUAL' ? 'Equal Split' : 'Custom Split'}
            </Text>
          </View>
        </View>
      </Card>

      {/* Shares Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Shares Breakdown ({payment.shares.length})
        </Text>

        <Card style={styles.sharesCard}>
          {payment.shares.map((share, idx) => {
            const isMe = share.user_id === user?.id;
            return (
              <React.Fragment key={share.user_id}>
                {idx > 0 && <View style={styles.divider} />}
                <View style={styles.shareRow}>
                  <View style={styles.shareUser}>
                    <Avatar name={share.display_name} size={36} />
                    <View style={styles.shareUserInfo}>
                      <Text style={styles.shareUserName}>
                        {isMe ? `${share.display_name} (You)` : share.display_name}
                      </Text>
                      <Text style={styles.shareUserHandle}>@{share.username}</Text>
                    </View>
                  </View>
                  <Text style={[styles.shareAmount, isVoided && styles.voidedText]}>
                    {formatMoney(share.amount_minor)}
                  </Text>
                </View>
              </React.Fragment>
            );
          })}
        </Card>
      </View>

      {/* Void Action (Only available if payment is active and user is payer) */}
      {!isVoided && isPayer && (
        <View style={styles.actionSection}>
          <Button
            title="Void This Payment"
            variant="destructive"
            onPress={() => setShowVoidConfirm(true)}
          />
          <Text style={styles.voidNote}>
            Voiding will cancel this payment from the ledger and recalculate all balances.
          </Text>
        </View>
      )}

      {/* Void Confirmation Dialog */}
      <ConfirmDialog
        visible={showVoidConfirm}
        title="Void Payment"
        message="Are you sure you want to void this payment? This action cannot be undone."
        confirmLabel="Void Payment"
        isDestructive
        isLoading={isVoiding}
        onConfirm={handleVoidPayment}
        onCancel={() => setShowVoidConfirm(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  voidBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningBg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.md,
    marginBottom: spacing.base,
    gap: spacing.sm,
  },
  voidBannerText: {
    flex: 1,
  },
  voidBannerTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.warning,
  },
  voidBannerSub: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  totalCard: {
    alignItems: 'center',
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  totalLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  totalAmount: {
    fontSize: typography.size.huge,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  voidedText: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  payerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  payerText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  payerName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  splitChip: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  splitChipText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  sharesCard: {
    padding: spacing.base,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  shareUser: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  shareUserInfo: {
    flex: 1,
  },
  shareUserName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  shareUserHandle: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
  },
  shareAmount: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  actionSection: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  voidNote: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});
