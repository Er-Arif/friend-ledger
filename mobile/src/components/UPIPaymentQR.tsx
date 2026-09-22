import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { colors } from '../constants/colors';
import { radius } from '../constants/radius';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { formatMoney } from '../utils/money';
import { buildUpiQrPayload } from '../utils/upi';

interface UPIPaymentQRProps {
  payeeUpiId: string;
  payeeName: string;
  amountMinor: number;
  transactionNote?: string;
}

export const UPIPaymentQR: React.FC<UPIPaymentQRProps> = ({
  payeeUpiId,
  payeeName,
  amountMinor,
  transactionNote,
}) => {
  const [copied, setCopied] = useState(false);

  const upiPayload = buildUpiQrPayload({
    payeeUpiId,
    payeeName,
    amountMinor,
    transactionNote: transactionNote || 'Friend Ledger settlement',
  });

  const handleCopyUpiId = async () => {
    await Clipboard.setStringAsync(payeeUpiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <View style={styles.container}>
      <View style={styles.amountBadge}>
        <Text style={styles.amountLabel}>PAYMENT AMOUNT</Text>
        <Text style={styles.amountValue}>{formatMoney(amountMinor)}</Text>
      </View>

      <View style={styles.qrContainer}>
        <QRCode
          value={upiPayload}
          size={200}
          color="#000000"
          backgroundColor="#FFFFFF"
        />
      </View>

      <Text style={styles.helperText}>
        Scan using Google Pay, PhonePe, Paytm, or any UPI app
      </Text>

      <View style={styles.vpaContainer}>
        <View style={styles.vpaInfo}>
          <Text style={styles.vpaLabel}>PAYEE UPI ID</Text>
          <Text style={styles.vpaText} numberOfLines={1}>
            {payeeUpiId}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.copyButton}
          onPress={handleCopyUpiId}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Copy UPI ID"
        >
          <Ionicons
            name={copied ? 'checkmark-circle' : 'copy-outline'}
            size={18}
            color={copied ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.copyText, copied && styles.copyTextSuccess]}>
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  amountBadge: {
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  amountLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: spacing.xxs,
  },
  amountValue: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.owedToMe,
  },
  qrContainer: {
    padding: spacing.base,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: spacing.base,
  },
  helperText: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.base,
    maxWidth: 240,
    lineHeight: 18,
  },
  vpaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.input,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
  },
  vpaInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  vpaLabel: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  vpaText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xxs,
  },
  copyText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.textSecondary,
  },
  copyTextSuccess: {
    color: colors.primary,
    fontWeight: typography.weight.semibold,
  },
});
