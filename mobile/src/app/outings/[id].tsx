import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Screen } from '../../components/ui/Screen';
import { AppHeader } from '../../components/ui/AppHeader';
import { StatusChip } from '../../components/ui/StatusChip';
import { Avatar } from '../../components/ui/Avatar';
import { PaymentCard } from '../../components/PaymentCard';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { api } from '../../lib/apiClient';
import { realtime } from '../../lib/realtime';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import {
  PaymentListResponse,
  PaymentRead,
  SessionDetailResponse,
  SessionFinishResponse,
  SessionLeaveResponse,
} from '../../types/api';
import { getFriendlyErrorMessage } from '../../lib/errors';
import { formatDate } from '../../utils/dates';
import { formatMoney } from '../../utils/money';

export default function OutingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const showToast = useToastStore((s) => s.show);

  const [session, setSession] = useState<SessionDetailResponse | null>(null);
  const [payments, setPayments] = useState<PaymentRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dialog state for leaving or finishing
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const loadData = useCallback(async (isPullToRefresh = false) => {
    if (!id) return;

    if (isPullToRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const [sessionRes, paymentsRes] = await Promise.all([
        api.get<SessionDetailResponse>(`/api/v1/sessions/${id}`),
        api.get<PaymentListResponse>(`/api/v1/sessions/${id}/payments`),
      ]);
      setSession(sessionRes);
      setPayments(paymentsRes.items);
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [loadData])
  );

  useEffect(() => {
    const unsub = realtime.subscribe((event) => {
      if (!event.session_id || event.session_id === id) {
        loadData(false);
      }
    });
    return unsub;
  }, [id, loadData]);

  const handleLeaveOuting = async () => {
    if (!id) return;
    setIsActionLoading(true);
    try {
      const res = await api.post<SessionLeaveResponse>(`/api/v1/sessions/${id}/leave`);
      setShowLeaveConfirm(false);
      showToast('You left the outing.', 'info');
      if (res.session_status === 'CLOSED') {
        showToast('Outing has ended since you were the last participant.', 'info');
      }
      loadData(false);
    } catch (err) {
      setShowLeaveConfirm(false);
      showToast(getFriendlyErrorMessage(err), 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleFinishOuting = async () => {
    if (!id) return;
    setIsActionLoading(true);
    try {
      await api.post<SessionFinishResponse>(`/api/v1/sessions/${id}/finish`);
      setShowFinishConfirm(false);
      showToast('Outing finished.', 'success');
      loadData(false);
    } catch (err) {
      setShowFinishConfirm(false);
      showToast(getFriendlyErrorMessage(err), 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  if (isLoading && !session) {
    return (
      <Screen>
        <LoadingState message="Loading outing details..." />
      </Screen>
    );
  }

  if (errorMessage && !session) {
    return (
      <Screen>
        <ErrorState
          title="Could not load outing"
          message={errorMessage}
          onRetry={() => loadData(false)}
        />
      </Screen>
    );
  }

  if (!session) return null;

  const isActive = session.status === 'ACTIVE';
  const isUserActive = session.current_user?.is_active ?? false;
  const activeCount = session.active_participants?.length ?? 0;
  const otherActiveParticipants = (session.active_participants ?? []).filter(
    (p) => p.user_id !== user?.id
  );
  const canAddPayment = isActive && isUserActive && otherActiveParticipants.length > 0;
  const title = session.name || 'Outing';

  // Calculate total spent in this outing (excluding voided payments)
  const totalSpentMinor = payments
    .filter((p) => p.status === 'ACTIVE')
    .reduce((sum, p) => sum + p.total_amount_minor, 0);

  return (
    <Screen
      scrollable
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => loadData(true)}
          tintColor={colors.primary}
        />
      }
      contentContainerStyle={styles.container}
    >
      <AppHeader
        title={title}
        subtitle={formatDate(session.created_at)}
        showBack
        rightAction={<StatusChip status={session.status} />}
      />

      {/* Join Code / QR banner for active sessions */}
      {isActive && session.join_code && (
        <TouchableOpacity
          style={styles.qrBanner}
          onPress={() =>
            router.push({
              pathname: '/outings/qr',
              params: { code: session.join_code, name: session.name || '' },
            })
          }
          activeOpacity={0.8}
        >
          <View style={styles.qrBannerLeft}>
            <View style={styles.qrIconWrap}>
              <Ionicons name="qr-code-outline" size={24} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.qrBannerCode}>Code: {session.join_code}</Text>
              <Text style={styles.qrBannerSub}>Tap to show QR code or share</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      )}

      {/* Outing Overview Card */}
      <View style={styles.metricsCard}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Total Spent</Text>
          <Text style={styles.metricValue}>{formatMoney(totalSpentMinor)}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Participants</Text>
          <Text style={styles.metricValue}>{activeCount}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Payments</Text>
          <Text style={styles.metricValue}>{payments.length}</Text>
        </View>
      </View>

      {/* Participants section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Participants ({session.active_participants.length})
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.participantsList}
        >
          {session.active_participants.map((p) => {
            const isMe = p.user_id === user?.id;
            return (
              <View key={p.user_id} style={styles.participantChip}>
                <Avatar name={p.display_name} size={32} />
                <Text style={styles.participantName} numberOfLines={1}>
                  {isMe ? `${p.display_name} (You)` : p.display_name}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* Payments Timeline section */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Payments</Text>
        </View>

        {canAddPayment && (
          <Button
            title="Add Payment"
            icon={<Ionicons name="add" size={20} color={colors.textInverse} style={{ marginRight: 6 }} />}
            variant="primary"
            onPress={() => router.push(`/payments/add?sessionId=${session.id}`)}
            style={styles.prominentAddPaymentBtn}
          />
        )}

        {payments.length === 0 ? (
          canAddPayment ? (
            <EmptyState
              icon="receipt-outline"
              title="No payments yet"
              description="When anyone pays for food, tickets, or drinks, record it here to split."
            />
          ) : isActive && isUserActive && otherActiveParticipants.length === 0 ? (
            <View style={styles.waitingCard}>
              <View style={styles.waitingIconWrap}>
                <Ionicons name="people-outline" size={32} color={colors.primary} />
              </View>
              <Text style={styles.waitingTitle}>Waiting for friends</Text>
              <Text style={styles.waitingSub}>
                Share the outing code or QR so someone can join before you add a shared payment.
              </Text>
              <View style={styles.waitingActionsRow}>
                {session.join_code ? (
                  <>
                    <Button
                      title="Show QR"
                      variant="primary"
                      onPress={() =>
                        router.push({
                          pathname: '/outings/qr',
                          params: { code: session.join_code, name: session.name || '' },
                        })
                      }
                      style={styles.waitingBtn}
                    />
                    <Button
                      title="Copy Code"
                      variant="outline"
                      onPress={async () => {
                        if (!session.join_code) return;
                        await Clipboard.setStringAsync(session.join_code);
                        showToast(`Outing code ${session.join_code} copied!`, 'info');
                      }}
                      style={styles.waitingBtn}
                    />
                  </>
                ) : null}
              </View>
            </View>
          ) : (
            <EmptyState
              icon="receipt-outline"
              title="No payments yet"
              description="No payments were recorded during this outing."
            />
          )
        ) : (
          payments.map((p) => (
            <PaymentCard
              key={p.id}
              payment={p}
              currentUserId={user?.id}
              onPress={() => router.push(`/payments/${p.id}`)}
            />
          ))
        )}
      </View>

      {/* Lifecycle Actions: Leave / Finish Outing */}
      {isActive && isUserActive && (
        <View style={styles.lifecycleSection}>
          {activeCount === 1 ? (
            <Button
              title="Finish Outing"
              variant="outline"
              onPress={() => setShowFinishConfirm(true)}
              style={styles.finishBtn}
            />
          ) : (
            <Button
              title="Leave Outing"
              variant="outline"
              onPress={() => setShowLeaveConfirm(true)}
              style={styles.leaveBtn}
            />
          )}
        </View>
      )}

      {/* Leave Confirmation Dialog */}
      <ConfirmDialog
        visible={showLeaveConfirm}
        title="Leave Outing"
        message="Are you sure you want to leave this outing? You won't be included in future payments unless you rejoin."
        confirmLabel="Leave Outing"
        isDestructive
        isLoading={isActionLoading}
        onConfirm={handleLeaveOuting}
        onCancel={() => setShowLeaveConfirm(false)}
      />

      {/* Finish Confirmation Dialog */}
      <ConfirmDialog
        visible={showFinishConfirm}
        title="Finish Outing"
        message="You are the only active participant. Finishing will close this outing permanently."
        confirmLabel="Finish Outing"
        isDestructive={false}
        isLoading={isActionLoading}
        onConfirm={handleFinishOuting}
        onCancel={() => setShowFinishConfirm(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  qrBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.owedToMeBg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.owedToMeBorder,
    padding: spacing.md,
    marginBottom: spacing.base,
  },
  qrBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  qrIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrBannerCode: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    letterSpacing: 1.5,
  },
  qrBannerSub: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  metricsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  metricValue: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  metricDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  prominentAddPaymentBtn: {
    marginBottom: spacing.base,
    width: '100%',
  },
  participantsList: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  participantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
    maxWidth: 160,
  },
  participantName: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.textPrimary,
  },
  lifecycleSection: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  leaveBtn: {
    borderColor: colors.border,
  },
  finishBtn: {
    borderColor: colors.primary,
  },
  waitingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.sm,
  },
  waitingIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  waitingTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  waitingSub: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
    marginBottom: spacing.lg,
  },
  waitingActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
    justifyContent: 'center',
  },
  waitingBtn: {
    flex: 1,
    maxWidth: 140,
  },
});
