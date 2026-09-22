import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/ui/Screen';
import { AppHeader } from '../../components/ui/AppHeader';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { OutingCard } from '../../components/OutingCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { api } from '../../lib/apiClient';
import { realtime } from '../../lib/realtime';
import { SessionListItem, SessionListResponse } from '../../types/api';
import { getFriendlyErrorMessage } from '../../lib/errors';

export default function OutingsScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'CLOSED'>('ACTIVE');
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchOutings = useCallback(async (isPullToRefresh = false) => {
    if (isPullToRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const res = await api.get<SessionListResponse>('/api/v1/sessions');
      setSessions(res.items);
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchOutings(false);
    }, [fetchOutings])
  );

  useEffect(() => {
    const unsub = realtime.subscribe((event) => {
      if (
        event.type === 'SESSION_CREATED' ||
        event.type === 'SESSION_UPDATED' ||
        event.type === 'PARTICIPANT_JOINED' ||
        event.type === 'PARTICIPANT_LEFT' ||
        event.type === 'SESSION_FINISHED'
      ) {
        fetchOutings(false);
      }
    });
    return unsub;
  }, [fetchOutings]);

  const activeOutings = sessions.filter((s) => s.status === 'ACTIVE');
  const pastOutings = sessions.filter((s) => s.status === 'CLOSED');

  const displayedOutings = activeTab === 'ACTIVE' ? activeOutings : pastOutings;

  return (
    <Screen
      scrollable
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => fetchOutings(true)}
          tintColor={colors.primary}
        />
      }
      contentContainerStyle={styles.container}
    >
      <AppHeader
        title="Outings"
        subtitle="Manage sessions with friends"
        rightAction={
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.joinIconBtn}
              onPress={() => router.push('/outings/join')}
              accessibilityLabel="Join outing with code"
            >
              <Ionicons name="qr-code-outline" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addIconBtn}
              onPress={() => router.push('/outings/start')}
              accessibilityLabel="Start new outing"
            >
              <Ionicons name="add" size={22} color={colors.textInverse} />
            </TouchableOpacity>
          </View>
        }
      />

      <SegmentedControl
        options={[
          { key: 'ACTIVE', label: 'Active', count: activeOutings.length },
          { key: 'CLOSED', label: 'Past', count: pastOutings.length },
        ]}
        selectedKey={activeTab}
        onSelect={(k) => setActiveTab(k as 'ACTIVE' | 'CLOSED')}
      />

      <View style={styles.listContainer}>
        {isLoading && !sessions.length ? (
          <LoadingState message="Loading outings..." />
        ) : errorMessage && !sessions.length ? (
          <ErrorState
            title="Could not load outings"
            message={errorMessage}
            onRetry={() => fetchOutings(false)}
          />
        ) : displayedOutings.length === 0 ? (
          activeTab === 'ACTIVE' ? (
            <EmptyState
              icon="people-outline"
              title="No active outings"
              description="Start a new outing for coffee, dinner, or a trip, or join a friend's outing."
              actionLabel="Start Outing"
              onAction={() => router.push('/outings/start')}
            />
          ) : (
            <EmptyState
              icon="archive-outline"
              title="No past outings"
              description="Outings that are finished will be listed here for reference."
            />
          )
        ) : (
          displayedOutings.map((session) => (
            <OutingCard
              key={session.id}
              session={session}
              onPress={() => router.push(`/outings/${session.id}`)}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  joinIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    marginTop: spacing.lg,
  },
});
