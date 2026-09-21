import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { radius } from '../constants/radius';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { BalanceItem } from '../types/api';
import { Avatar } from './ui/Avatar';
import { MoneyText } from './ui/MoneyText';

interface PersonBalanceRowProps {
  item: BalanceItem;
  onPress: () => void;
}

export const PersonBalanceRow: React.FC<PersonBalanceRowProps> = ({ item, onPress }) => {
  const isIOwe = item.direction === 'I_OWE';
  const label = isIOwe ? `You owe ${item.person.display_name}` : `${item.person.display_name} owes you`;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${item.amount_minor}`}
    >
      <Avatar name={item.person.display_name} size={44} style={styles.avatar} />
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {item.person.display_name}
        </Text>
        <Text style={styles.subtext} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.amountContainer}>
        <MoneyText
          amountMinor={item.amount_minor}
          direction={item.direction}
          size="normal"
        />
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.chevron} />
      </View>
    </TouchableOpacity>
  );
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
  avatar: {
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  subtext: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevron: {
    marginLeft: spacing.xs,
  },
});
