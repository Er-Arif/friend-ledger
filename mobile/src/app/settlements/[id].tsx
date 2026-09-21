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
import { SettlementRead } from '../../types/api';
import { getFriendlyErrorMessage } from '../../lib/errors';
import { formatDateTime } from '../../utils/dates';
import { formatMoney } from '../../utils/money';

export default function SettlementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const showToast = useToastStore((s) => s.show);

  const [settlement, setSettlement] = useState<SettlementRead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);

  const fetchSettlement = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.get<SettlementRead>(`/api/v1/settlements/${id}`);
      setSettlement(res);
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      fetchSettlement();
    }, [fetchSettlement])
  );

  const handleVoidSettlement = async () => {
    if (!id) return;
    setIsVoiding(true);

    try {
      const idempotencyKey = api.generateIdempotencyKey();
      const res = await api.post<SettlementRead>(
        `/api/v1/settlements/${id}/void`,
        { reason: 'Voided by user' },
        { idempotencyKey }
      );
      setSettlement(res);
      setShowVoidConfirm(false);
      showToast('Settlement voided.', 'info');
    } catch (err) {
      setShowVoidConfirm(false);
      showToast(getFriendlyErrorMessage(err), 'error');
    } finally {
      setIsVoiding(false);
    }
  };

  if (isLoading && !settlement) {
    return (
      <Screen>
        <LoadingState message="Loading settlement details..." />
      </Screen>
    );
  }

  if (errorMessage && !settlement) {
    return (
      <Screen>
        <ErrorState
          title="Could not load settlement"
          message={errorMessage}
          onRetry={fetchSettlement}
        />
      </Screen>
    );
  }

  if (!settlement) return null;

  const isVoided = settlement.status === 'VOIDED';
  const isPayer = user?.id === settlement.from_user.user_id;

  return (
    <Screen scrollable contentContainerStyle={styles.container}>
      <AppHeader
        title="Settlement"
        subtitle={formatDateTime(settlement.created_at)}
        showBack
        rightAction={<StatusChip status={settlement.status} />}
      />

      {/* Void Banner */}
      {isVoided && (
        <View style={styles.voidBanner}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.warning} />
          <View style={styles.voidBannerText}>
            <Text style={styles.voidBannerTitle}>This settlement has been voided</Text>
            {settlement.voided_at && (
              <Text style={styles.voidBannerSub}>
                Voided on {formatDateTime(settlement.voided_at)}
                {settlement.void_reason ? ` • "${settlement.void_reason}"` : ''}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Main Settlement Card */}
      <Card style={styles.mainCard}>
        <Text style={styles.amountLabel}>REPAID AMOUNT</Text>
        <Text style={[styles.amountValue, isVoided && styles.voidedText]}>
          {formatMoney(settlement.amount_minor)}
        </Text>

        <View style={styles.methodBadge}>
          <Ionicons name="card-outline" size={14} color={colors.primary} />
          <Text style={styles.methodText}>{settlement.method}</Text>
        </View>

        {/* Transfer Participants */}
        <View style={styles.transferRow}>
          <View style={styles.userBox}>
            <Avatar name={settlement.from_user.display_name} size={40} />
            <Text style={styles.userRole}>From (Payer)</Text>
            <Text style={styles.userName} numberOfLines={1}>
              {settlement.from_user.user_id === user?.id
                ? `${settlement.from_user.display_name} (You)`
                : settlement.from_user.display_name}
            </Text>
          </View>

          <View style={styles.arrowBox}>
            <Ionicons name="arrow-forward" size={20} color={colors.primary} />
          </View>

          <View style={styles.userBox}>
            <Avatar name={settlement.to_user.display_name} size={40} />
            <Text style={styles.userRole}>To (Recipient)</Text>
            <Text style={styles.userName} numberOfLines={1}>
              {settlement.to_user.user_id === user?.id
                ? `${settlement.to_user.display_name} (You)`
                : settlement.to_user.display_name}
            </Text>
          </View>
        </View>

        {settlement.note ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>Note</Text>
            <Text style={styles.noteText}>{settlement.note}</Text>
          </View>
        ) : null}
      </Card>

      {/* Void Settlement Button (Only if active and current user is the payer) */}
      {!isVoided && isPayer && (
        <View style={styles.actionSection}>
          <Button
            title="Void This Settlement"
            variant="destructive"
            onPress={() => setShowVoidConfirm(true)}
          />
          <Text style={styles.voidNote}>
            Voiding will restore this amount to your outstanding balance with this friend.
          </Text>
        </View>
      )}

      {/* Void Confirmation Dialog */}
      <ConfirmDialog
        visible={showVoidConfirm}
        title="Void Settlement"
        message="Are you sure you want to void this settlement? This will restore the debt balance."
        confirmLabel="Void Settlement"
        isDestructive
        isLoading={isVoiding}
        onConfirm={handleVoidSettlement}
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
  mainCard: {
    alignItems: 'center',
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  amountLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  amountValue: {
    fontSize: typography.size.huge,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  voidedText: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.owedToMeBg,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    gap: 4,
    marginBottom: spacing.xl,
  },
  methodText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.owedToMe,
  },
  transferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  userBox: {
    alignItems: 'center',
    flex: 1,
  },
  userRole: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  userName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginTop: 2,
    textAlign: 'center',
  },
  arrowBox: {
    paddingHorizontal: spacing.sm,
  },
  noteBox: {
    width: '100%',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.card,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  noteLabel: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    fontWeight: typography.weight.bold,
    marginBottom: 2,
  },
  noteText: {
    fontSize: typography.size.sm,
    color: colors.textPrimary,
  },
  actionSection: {
    marginTop: spacing.sm,
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
