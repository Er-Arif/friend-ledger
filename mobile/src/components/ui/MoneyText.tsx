import React from 'react';
import { StyleSheet, Text, TextStyle } from 'react-native';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { formatMoney } from '../../utils/money';

interface MoneyTextProps {
  amountMinor: number;
  direction?: 'I_OWE' | 'OWED_TO_ME' | 'NEUTRAL';
  size?: 'normal' | 'large' | 'huge' | 'small';
  style?: TextStyle;
  showDecimalIfZero?: boolean;
}

export const MoneyText: React.FC<MoneyTextProps> = ({
  amountMinor,
  direction = 'NEUTRAL',
  size = 'normal',
  style,
  showDecimalIfZero,
}) => {
  const formatted = formatMoney(amountMinor, { showDecimalIfZero });

  const colorStyle = {
    I_OWE: { color: colors.iOwe },
    OWED_TO_ME: { color: colors.owedToMe },
    NEUTRAL: { color: colors.textPrimary },
  }[direction];

  return <Text style={[styles.base, styles[size], colorStyle, style]}>{formatted}</Text>;
};

const styles = StyleSheet.create({
  base: {
    fontWeight: typography.weight.bold,
  },
  small: {
    fontSize: typography.size.sm,
  },
  normal: {
    fontSize: typography.size.lg,
  },
  large: {
    fontSize: typography.size.xxl,
  },
  huge: {
    fontSize: typography.size.huge,
  },
});
