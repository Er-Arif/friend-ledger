import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { SessionListItem } from '../types/api';
import { formatDate } from '../utils/dates';
import { Card } from './ui/Card';
import { StatusChip } from './ui/StatusChip';

interface OutingCardProps {
  session: SessionListItem;
  onPress: () => void;
}

export const OutingCard: React.FC<OutingCardProps> = ({ session, onPress }) => {
  const isActive = session.status === 'ACTIVE';
  const name = session.name || 'Outing';
  const dateStr = formatDate(session.created_at);

  return (
    <Card
      onPress={onPress}
      variant={isActive ? 'default' : 'muted'}
      style={styles.card}
      accessibilityLabel={`Outing ${name}, ${isActive ? 'Active' : 'Ended'}`}
    >
      <View style={styles.header}>
        <View style={styles.titleArea}>
          <Text style={styles.title} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.date}>{dateStr}</Text>
        </View>
        <StatusChip status={session.status} />
      </View>

      <View style={styles.footer}>
        <View style={styles.metaItem}>
          <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.metaText}>
            {session.active_participant_count}{' '}
            {session.active_participant_count === 1 ? 'person' : 'people'}
          </Text>
        </View>

        {session.current_user_is_active && isActive && (
          <View style={styles.activeUserBadge}>
            <View style={styles.dot} />
            <Text style={styles.activeUserText}>{"You're in"}</Text>
          </View>
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  titleArea: {
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  date: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  activeUserBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  activeUserText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
});
