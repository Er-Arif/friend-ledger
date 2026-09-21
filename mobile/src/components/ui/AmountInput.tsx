import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { colors } from '../../constants/colors';
import { radius } from '../../constants/radius';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';

interface AmountInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string | null;
  style?: ViewStyle;
}

export const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChangeText,
  placeholder = '0',
  error,
  style,
}) => {
  const handleChange = (text: string) => {
    // Only allow numbers and at most one decimal point
    const sanitized = text.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    if (parts.length > 2) return; // Disallow multiple decimals
    if (parts[1] && parts[1].length > 2) return; // Disallow more than 2 decimal places

    onChangeText(sanitized);
  };

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
        <Text style={styles.currencySymbol}>₹</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          autoFocus={false}
          accessibilityLabel="Payment amount in rupees"
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  inputRowError: {
    borderColor: colors.error,
    backgroundColor: colors.errorBg,
  },
  currencySymbol: {
    fontSize: typography.size.huge,
    fontWeight: typography.weight.bold,
    color: colors.primary,
    marginRight: spacing.sm,
  },
  input: {
    fontSize: typography.size.huge,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    minWidth: 120,
    textAlign: 'left',
  },
  errorText: {
    fontSize: typography.size.xs,
    color: colors.error,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
