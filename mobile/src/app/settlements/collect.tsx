import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../components/ui/Screen';
import { AppHeader } from '../../components/ui/AppHeader';
import { AmountInput } from '../../components/ui/AmountInput';
import { EmptyState } from '../../components/ui/EmptyState';
import { Card } from '../../components/ui/Card';
import { UPIPaymentQR } from '../../components/UPIPaymentQR';
import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { useAuthStore } from '../../stores/authStore';
import { formatMoney, parseRupeesToPaise } from '../../utils/money';

export default function CollectPaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    userId?: string;
    name?: string;
    amountMinor?: string;
  }>();

  const user = useAuthStore((s) => s.user);

  const debtorName = params.name || 'Friend';
  const outstandingPaise = params.amountMinor ? parseInt(params.amountMinor, 10) : 0;

  const [amountStr, setAmountStr] = useState(
    outstandingPaise > 0 ? (outstandingPaise / 100).toString() : ''
  );
  const [error, setError] = useState<string | null>(null);

  // Prerequisite: creditor must have a configured UPI ID
  if (!user?.upi_id) {
    return (
      <Screen contentContainerStyle={styles.container}>
        <AppHeader
          title="Collect via UPI"
          subtitle={`From ${debtorName}`}
          showBack
        />
        <EmptyState
          icon="wallet-outline"
          title="Add your UPI ID"
          description="Add your UPI ID to receive payments through a UPI QR code."
          actionLabel="Go to Profile"
          onAction={() => router.push('/(tabs)/profile')}
        />
      </Screen>
    );
  }

  const handleFillFullAmount = () => {
    if (outstandingPaise > 0) {
      setAmountStr((outstandingPaise / 100).toString());
      setError(null);
    }
  };

  const handleAmountChange = (text: string) => {
    setAmountStr(text);
    const parsed = parseRupeesToPaise(text);
    if (parsed <= 0) {
      setError('Please enter an amount greater than zero.');
    } else if (outstandingPaise > 0 && parsed > outstandingPaise) {
      setError(`Amount cannot exceed outstanding balance of ${formatMoney(outstandingPaise)}.`);
    } else {
      setError(null);
    }
  };

  const currentPaise = parseRupeesToPaise(amountStr);
  const isAmountValid = currentPaise > 0 && (outstandingPaise === 0 || currentPaise <= outstandingPaise);

  return (
    <Screen scrollable contentContainerStyle={styles.container}>
      <AppHeader
        title="Collect via UPI"
        subtitle={`From ${debtorName}`}
        showBack
      />

      <View style={styles.content}>
        {/* Outstanding Card */}
        <Card style={styles.debtCard}>
          <Text style={styles.debtLabel}>OUTSTANDING BALANCE</Text>
          <Text style={styles.debtValue}>{formatMoney(outstandingPaise)}</Text>
          <Text style={styles.debtSub}>
            {debtorName} owes you this amount across active outings
          </Text>
        </Card>

        {/* Amount Section */}
        <View style={styles.amountSection}>
          <View style={styles.amountHeaderRow}>
            <Text style={styles.sectionLabel}>Collection Amount</Text>
            {outstandingPaise > 0 && currentPaise !== outstandingPaise && (
              <TouchableOpacity
                onPress={handleFillFullAmount}
                style={styles.fullAmountBtn}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={styles.fullAmountText}>Full Amount</Text>
              </TouchableOpacity>
            )}
          </View>

          <AmountInput
            value={amountStr}
            onChangeText={handleAmountChange}
            placeholder="0"
          />

          {error ? (
            <View style={styles.errorAlert}>
              <Text style={styles.errorAlertText}>{error}</Text>
            </View>
          ) : null}
        </View>

        {/* Dynamic UPI QR Code */}
        {isAmountValid ? (
          <View style={styles.qrSection}>
            <UPIPaymentQR
              payeeUpiId={user.upi_id}
              payeeName={user.display_name}
              amountMinor={currentPaise}
              transactionNote={`Friend Ledger settlement from ${debtorName}`}
            />

            <View style={styles.ledgerRuleNotice}>
              <Text style={styles.ledgerRuleTitle}>Settlement Confirmation</Text>
              <Text style={styles.ledgerRuleText}>
                Ask {debtorName} to scan this QR code with their UPI app. Once paid,{' '}
                {debtorName} will confirm the settlement in their Friend Ledger app, and your
                balance will update automatically in real-time.
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  content: {
    marginTop: spacing.sm,
  },
  debtCard: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: colors.owedToMeBg,
    borderColor: colors.owedToMeBorder,
    marginBottom: spacing.lg,
  },
  debtLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.owedToMe,
    letterSpacing: 0.8,
    marginBottom: spacing.xxs,
  },
  debtValue: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.owedToMe,
  },
  debtSub: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xxs,
  },
  amountSection: {
    marginBottom: spacing.lg,
  },
  amountHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sectionLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fullAmountBtn: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
  },
  fullAmountText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.primary,
  },
  errorAlert: {
    backgroundColor: colors.errorBg,
    borderRadius: radius.input,
    padding: spacing.sm,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorAlertText: {
    color: colors.error,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    textAlign: 'center',
  },
  qrSection: {
    marginTop: spacing.xs,
  },
  ledgerRuleNotice: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.card,
    padding: spacing.base,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ledgerRuleTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  ledgerRuleText: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
