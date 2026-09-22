import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen } from '../../components/ui/Screen';
import { AppHeader } from '../../components/ui/AppHeader';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { PersonBalanceRow } from '../../components/PersonBalanceRow';
import { MoneyText } from '../../components/ui/MoneyText';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { api } from '../../lib/apiClient';
import { realtime } from '../../lib/realtime';
import { BalanceItem, BalanceSummaryResponse } from '../../types/api';
import { getFriendlyErrorMessage } from '../../lib/errors';

export default function BalancesScreen() {
  const router = useRouter();

  const [activeSegment, setActiveSegment] = useState<'ALL' | 'I_OWE' | 'OWED_TO_ME'>('ALL');
  const [data, setData] = useState<BalanceSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchBalances = useCallback(async (isPullToRefresh = false) => {
    if (isPullToRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const res = await api.get<BalanceSummaryResponse>('/api/v1/me/balances');
      setData(res);
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBalances(false);
    }, [fetchBalances])
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
        fetchBalances(false);
      }
    });
    return unsub;
  }, [fetchBalances]);

  const items = data?.items ?? [];
  const iOweItems = items.filter((item) => item.direction === 'I_OWE');
  const owedToMeItems = items.filter((item) => item.direction === 'OWED_TO_ME');

  let filteredItems: BalanceItem[] = [];
  if (activeSegment === 'ALL') {
    filteredItems = items;
  } else if (activeSegment === 'I_OWE') {
    filteredItems = iOweItems;
  } else {
    filteredItems = owedToMeItems;
  }

  return (
    <Screen
      scrollable
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => fetchBalances(true)}
          tintColor={colors.primary}
        />
      }
      contentContainerStyle={styles.container}
    >
      <AppHeader
        title="Balances"
        subtitle="Individual balances with each friend"
      />

      {/* Summary Total Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryColumn}>
          <Text style={styles.summaryLabel}>Total You Owe</Text>
          <MoneyText
            amountMinor={data?.total_i_owe_minor ?? 0}
            direction={data?.total_i_owe_minor ? 'I_OWE' : 'NEUTRAL'}
            size="large"
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryColumn}>
          <Text style={styles.summaryLabel}>Total Owed To You</Text>
          <MoneyText
            amountMinor={data?.total_owed_to_me_minor ?? 0}
            direction={data?.total_owed_to_me_minor ? 'OWED_TO_ME' : 'NEUTRAL'}
            size="large"
          />
        </View>
      </View>

      <SegmentedControl
        options={[
          { key: 'ALL', label: 'All', count: items.length },
          { key: 'I_OWE', label: 'I Owe', count: iOweItems.length },
          { key: 'OWED_TO_ME', label: 'Owed to Me', count: owedToMeItems.length },
        ]}
        selectedKey={activeSegment}
        onSelect={(k) => setActiveSegment(k as 'ALL' | 'I_OWE' | 'OWED_TO_ME')}
      />

      <View style={styles.listContainer}>
        {isLoading && !data ? (
          <LoadingState message="Loading balances..." />
        ) : errorMessage && !data ? (
          <ErrorState
            title="Could not load balances"
            message={errorMessage}
            onRetry={() => fetchBalances(false)}
          />
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon="scale-outline"
            title={
              activeSegment === 'I_OWE'
                ? 'You do not owe anyone'
                : activeSegment === 'OWED_TO_ME'
                ? 'Nobody owes you'
                : 'All settled up'
            }
            description={
              activeSegment === 'ALL'
                ? 'Whenever you participate in outings or record settlements, pairwise balances are tracked here.'
                : undefined
            }
          />
        ) : (
          filteredItems.map((item) => (
            <PersonBalanceRow
              key={item.person.user_id}
              item={item}
              onPress={() => router.push(`/balances/${item.person.user_id}`)}
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
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  summaryColumn: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
  },
  listContainer: {
    marginTop: spacing.lg,
  },
});
