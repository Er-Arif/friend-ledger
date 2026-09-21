import React, { useCallback, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { MoneyText } from '../../components/ui/MoneyText';
import { PersonBalanceRow } from '../../components/PersonBalanceRow';
import { OutingCard } from '../../components/OutingCard';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { api } from '../../lib/apiClient';
import { useAuthStore } from '../../stores/authStore';
import { BalanceSummaryResponse, SessionListItem, SessionListResponse } from '../../types/api';
import { getFriendlyErrorMessage } from '../../lib/errors';

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [balances, setBalances] = useState<BalanceSummaryResponse | null>(null);
  const [activeSession, setActiveSession] = useState<SessionListItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async (isPullToRefresh = false) => {
    if (isPullToRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const [balanceRes, sessionsRes] = await Promise.all([
        api.get<BalanceSummaryResponse>('/api/v1/me/balances'),
        api.get<SessionListResponse>('/api/v1/sessions'),
      ]);

      setBalances(balanceRes);

      // Look for an active session where user is currently active
      const active = sessionsRes.items.find(
        (s) => s.status === 'ACTIVE' && s.current_user_is_active
      );
      setActiveSession(active || null);
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [loadData])
  );

  if (isLoading && !balances) {
    return (
      <Screen>
        <LoadingState message="Loading your balances..." />
      </Screen>
    );
  }

  if (errorMessage && !balances) {
    return (
      <Screen>
        <ErrorState
          title="Couldn't load dashboard"
          message={errorMessage}
          onRetry={() => loadData(false)}
        />
      </Screen>
    );
  }

  const iOweAmount = balances?.total_i_owe_minor ?? 0;
  const owedToMeAmount = balances?.total_owed_to_me_minor ?? 0;
  const balanceItems = balances?.items ?? [];

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
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Friend Ledger</Text>
          <Text style={styles.userName}>
            {user ? `Hi, ${user.display_name}` : 'Welcome'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.avatarButton}
          onPress={() => router.push('/(tabs)/profile')}
          accessibilityLabel="View profile"
        >
          <Ionicons name="person-circle-outline" size={36} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Net Summary Cards */}
      <View style={styles.summaryRow}>
        <Card
          variant="iOwe"
          style={styles.summaryCard}
          onPress={() => router.push('/(tabs)/balances')}
          accessibilityLabel={`You owe total ${iOweAmount}`}
        >
          <Text style={styles.summaryLabel}>I OWE</Text>
          <MoneyText
            amountMinor={iOweAmount}
            direction={iOweAmount > 0 ? 'I_OWE' : 'NEUTRAL'}
            size="large"
          />
          <Text style={styles.summaryCaption}>Total to pay</Text>
        </Card>

        <Card
          variant="owedToMe"
          style={styles.summaryCard}
          onPress={() => router.push('/(tabs)/balances')}
          accessibilityLabel={`Owed to you total ${owedToMeAmount}`}
        >
          <Text style={styles.summaryLabel}>OWED TO ME</Text>
          <MoneyText
            amountMinor={owedToMeAmount}
            direction={owedToMeAmount > 0 ? 'OWED_TO_ME' : 'NEUTRAL'}
            size="large"
          />
          <Text style={styles.summaryCaption}>Total to collect</Text>
        </Card>
      </View>

      {/* Action Buttons: Start Outing & Join Outing */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.startBtn]}
          onPress={() => router.push('/outings/start')}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Ionicons name="add-circle" size={22} color={colors.textInverse} />
          <Text style={styles.startBtnText}>Start Outing</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.joinBtn]}
          onPress={() => router.push('/outings/join')}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Ionicons name="qr-code-outline" size={20} color={colors.textPrimary} />
          <Text style={styles.joinBtnText}>Join Outing</Text>
        </TouchableOpacity>
      </View>

      {/* Active Outing Highlight */}
      {activeSession && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.activeDotContainer}>
              <View style={styles.livePulseDot} />
              <Text style={styles.sectionTitle}>Current Outing</Text>
            </View>
          </View>
          <OutingCard
            session={activeSession}
            onPress={() => router.push(`/outings/${activeSession.id}`)}
          />
        </View>
      )}

      {/* Pairwise Balances Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>People</Text>
          {balanceItems.length > 0 && (
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/balances')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.seeAllLink}>See all</Text>
            </TouchableOpacity>
          )}
        </View>

        {balanceItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-done-circle-outline" size={32} color={colors.primary} />
            <Text style={styles.emptyTitle}>All settled up</Text>
            <Text style={styles.emptySubtitle}>
              {"You don't have any outstanding balances with friends right now."}
            </Text>
          </View>
        ) : (
          balanceItems.slice(0, 5).map((item) => (
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  greeting: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  userName: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  avatarButton: {
    padding: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryCard: {
    flex: 1,
    padding: spacing.base,
    borderRadius: radius.card,
  },
  summaryLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  summaryCaption: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.button,
    gap: spacing.sm,
  },
  startBtn: {
    backgroundColor: colors.primary,
    elevation: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  startBtnText: {
    color: colors.textInverse,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
  },
  joinBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  joinBtnText: {
    color: colors.textPrimary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  activeDotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  sectionTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  seeAllLink: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  emptyTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  emptySubtitle: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});
