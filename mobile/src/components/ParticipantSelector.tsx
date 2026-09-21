import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { radius } from '../constants/radius';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { ParticipantRead } from '../types/api';
import { formatMoney, parseRupeesToPaise } from '../utils/money';
import { Avatar } from './ui/Avatar';

interface ParticipantSelectorProps {
  participants: ParticipantRead[];
  currentUserId: string;
  splitType: 'EQUAL' | 'CUSTOM';
  selectedUserIds: string[];
  onToggleUser: (userId: string) => void;
  customAmounts: Record<string, string>;
  onChangeCustomAmount: (userId: string, amountStr: string) => void;
  totalAmountMinor: number;
}

export const ParticipantSelector: React.FC<ParticipantSelectorProps> = ({
  participants,
  currentUserId,
  splitType,
  selectedUserIds,
  onToggleUser,
  customAmounts,
  onChangeCustomAmount,
  totalAmountMinor,
}) => {
  const selectedCount = selectedUserIds.length;
  const approxPerPerson = selectedCount > 0 ? Math.floor(totalAmountMinor / selectedCount) : 0;

  // Custom split totals
  const totalCustomPaise = selectedUserIds.reduce((sum, uid) => {
    return sum + parseRupeesToPaise(customAmounts[uid] || '0');
  }, 0);

  const customDifference = totalAmountMinor - totalCustomPaise;
  const isCustomExact = totalAmountMinor > 0 && customDifference === 0;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>Shared With</Text>

      {participants.map((person) => {
        const isSelected = selectedUserIds.includes(person.user_id);
        const isCurrentUser = person.user_id === currentUserId;
        const displayName = isCurrentUser ? `${person.display_name} (You)` : person.display_name;

        return (
          <View
            key={person.user_id}
            style={[styles.row, !isSelected && styles.rowDisabled]}
          >
            <TouchableOpacity
              style={styles.personInfo}
              onPress={() => onToggleUser(person.user_id)}
              activeOpacity={0.7}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
            >
              <View
                style={[
                  styles.checkbox,
                  isSelected && styles.checkboxSelected,
                ]}
              >
                {isSelected && (
                  <Ionicons name="checkmark" size={16} color={colors.textInverse} />
                )}
              </View>

              <Avatar name={person.display_name} size={36} style={styles.avatar} />

              <View style={styles.nameArea}>
                <Text style={styles.displayName} numberOfLines={1}>
                  {displayName}
                </Text>
                {splitType === 'EQUAL' && isSelected && totalAmountMinor > 0 && (
                  <Text style={styles.equalSharePreview}>
                    Approx. {formatMoney(approxPerPerson)}
                  </Text>
                )}
              </View>
            </TouchableOpacity>

            {splitType === 'CUSTOM' && isSelected && (
              <View style={styles.customInputContainer}>
                <Text style={styles.currencyPrefix}>₹</Text>
                <TextInput
                  style={styles.customInput}
                  value={customAmounts[person.user_id] || ''}
                  onChangeText={(text) => {
                    const sanitized = text.replace(/[^0-9.]/g, '');
                    onChangeCustomAmount(person.user_id, sanitized);
                  }}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  accessibilityLabel={`Custom amount for ${displayName}`}
                />
              </View>
            )}
          </View>
        );
      })}

      {splitType === 'CUSTOM' && totalAmountMinor > 0 && (
        <View style={[styles.customSummary, isCustomExact ? styles.summaryExact : styles.summaryMismatch]}>
          <Text style={[styles.summaryText, isCustomExact ? styles.summaryTextExact : styles.summaryTextMismatch]}>
            Allocated {formatMoney(totalCustomPaise)} / {formatMoney(totalAmountMinor)}
          </Text>
          {!isCustomExact && (
            <Text style={styles.differenceText}>
              {customDifference > 0
                ? `${formatMoney(customDifference)} remaining`
                : `${formatMoney(Math.abs(customDifference))} over total`}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
  },
  sectionHeader: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.base,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs + 2,
  },
  rowDisabled: {
    opacity: 0.55,
    backgroundColor: colors.surfaceSecondary,
  },
  personInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.borderMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  avatar: {
    marginRight: spacing.sm,
  },
  nameArea: {
    flex: 1,
  },
  displayName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  equalSharePreview: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  customInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.input,
    paddingHorizontal: spacing.sm,
    height: 38,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencyPrefix: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textSecondary,
    marginRight: 2,
  },
  customInput: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    minWidth: 70,
    textAlign: 'right',
  },
  customSummary: {
    padding: spacing.md,
    borderRadius: radius.input,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  summaryExact: {
    backgroundColor: colors.owedToMeBg,
    borderColor: colors.owedToMeBorder,
    borderWidth: 1,
  },
  summaryMismatch: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warning,
    borderWidth: 1,
  },
  summaryText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  summaryTextExact: {
    color: colors.owedToMe,
  },
  summaryTextMismatch: {
    color: colors.warning,
  },
  differenceText: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
