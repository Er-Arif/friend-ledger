import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/ui/Screen';
import { AppHeader } from '../../components/ui/AppHeader';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { LedgerEntryRow } from '../../components/LedgerEntryRow';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { api } from '../../lib/apiClient';
import { realtime } from '../../lib/realtime';
import { PairwiseLedgerResponse } from '../../types/api';
import { getFriendlyErrorMessage } from '../../lib/errors';
import { formatMoney } from '../../utils/money';

export default function PairwiseLedgerScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();

  const [ledger, setLedger] = useState<PairwiseLedgerResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchLedger = useCallback(async (isPullToRefresh = false) => {
    if (!userId) return;

    if (isPullToRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const res = await api.get<PairwiseLedgerResponse>(`/api/v1/me/balances/${userId}/ledger`);
      setLedger(res);
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      fetchLedger(false);
    }, [fetchLedger])
  );

  useEffect(() => {
    const unsub = realtime.subscribe((event) => {
      if (
        event.type === 'PAYMENT_CREATED' ||
        event.type === 'PAYMENT_VOIDED' ||
        event.type === 'SETTLEMENT_CREATED' ||
        event.type === 'SETTLEMENT_VOIDED' ||
        event.type === 'BALANCE_CHANGED'
      ) {
        fetchLedger(false);
      }
    });
    return unsub;
  }, [fetchLedger]);

  if (isLoading && !ledger) {
    return (
      <Screen>
        <LoadingState message="Loading pairwise ledger..." />
      </Screen>
    );
  }

  if (errorMessage && !ledger) {
    return (
      <Screen>
        <ErrorState
          title="Could not load ledger"
          message={errorMessage}
          onRetry={() => fetchLedger(false)}
        />
      </Screen>
    );
  }

  if (!ledger) return null;

  const { person, balance, entries } = ledger;
  const isIOwe = balance.direction === 'I_OWE';
  const isOwedToMe = balance.direction === 'OWED_TO_ME';
  const isSettled = balance.direction === 'SETTLED' || balance.amount_minor === 0;

  let bannerBg: string = colors.surface;
  let bannerBorder: string = colors.border;
  let bannerTextColor: string = colors.textPrimary;
  let statementText = `You and ${person.display_name} are settled up`;

  if (isIOwe) {
    bannerBg = colors.iOweBg;
    bannerBorder = colors.iOweBorder;
    bannerTextColor = colors.iOwe;
    statementText = `You owe ${person.display_name} ${formatMoney(balance.amount_minor)}`;
  } else if (isOwedToMe) {
    bannerBg = colors.owedToMeBg;
    bannerBorder = colors.owedToMeBorder;
    bannerTextColor = colors.owedToMe;
    statementText = `${person.display_name} owes you ${formatMoney(balance.amount_minor)}`;
  }

  return (
    <Screen
      scrollable
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => fetchLedger(true)}
          tintColor={colors.primary}
        />
      }
      contentContainerStyle={styles.container}
    >
      <AppHeader
        title={person.display_name}
        subtitle={`@${person.username}`}
        showBack
      />

      {/* Profile & Net Statement Card */}
      <View style={[styles.balanceCard, { backgroundColor: bannerBg, borderColor: bannerBorder }]}>
        <Avatar name={person.display_name} size={54} />
        <Text style={[styles.statementText, { color: bannerTextColor }]}>
          {statementText}
        </Text>
        <Text style={styles.statementSub}>
          {isSettled
            ? 'No outstanding balances between you two'
            : isIOwe
            ? 'Direct pairwise balance from shared outings'
            : 'Pending repayment from shared outings'}
        </Text>

        {isIOwe && balance.amount_minor > 0 && (
          <Button
            title="Record Settlement"
            onPress={() =>
              router.push({
                pathname: '/settlements/record',
                params: {
                  toUserId: person.user_id,
                  toName: person.display_name,
                  maxAmountMinor: balance.amount_minor.toString(),
                  counterpartyUpiId: balance.counterparty_upi_id || '',
                },
              })
            }
            style={styles.settleBtn}
          />
        )}

        {isOwedToMe && balance.amount_minor > 0 && (
          <Button
            title="Collect via UPI"
            icon={<Ionicons name="qr-code-outline" size={18} color={colors.textInverse} style={{ marginRight: 6 }} />}
            onPress={() =>
              router.push({
                pathname: '/settlements/collect',
                params: {
                  userId: person.user_id,
                  name: person.display_name,
                  amountMinor: balance.amount_minor.toString(),
                },
              })
            }
            style={styles.settleBtn}
          />
        )}
      </View>

      {/* Transaction History Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Transaction History ({entries.length})
        </Text>

        {entries.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="No activity recorded"
            description="When you participate in outings or record settlements together, transactions will appear here."
          />
        ) : (
          entries.map((entry, idx) => (
            <LedgerEntryRow
              key={entry.payment_id || entry.settlement_id || idx}
              entry={entry}
              onPress={() => {
                if (entry.payment_id) {
                  router.push(`/payments/${entry.payment_id}`);
                } else if (entry.settlement_id) {
                  router.push(`/settlements/${entry.settlement_id}`);
                }
              }}
            />
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  balanceCard: {
    alignItems: 'center',
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  statementText: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  statementSub: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  settleBtn: {
    marginTop: spacing.lg,
    width: '100%',
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
});
