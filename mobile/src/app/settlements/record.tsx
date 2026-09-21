import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../components/ui/Screen';
import { AppHeader } from '../../components/ui/AppHeader';
import { AmountInput } from '../../components/ui/AmountInput';
import { FormField } from '../../components/ui/FormField';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Button } from '../../components/ui/Button';
import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { api } from '../../lib/apiClient';
import { useToastStore } from '../../stores/toastStore';
import { SettlementCreateRequest, SettlementMethod, SettlementRead } from '../../types/api';
import { getFriendlyErrorMessage } from '../../lib/errors';
import { formatMoney, parseRupeesToPaise } from '../../utils/money';

export default function RecordSettlementScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    toUserId: string;
    toName?: string;
    maxAmountMinor?: string;
  }>();

  const showToast = useToastStore((s) => s.show);

  const toUserId = params.toUserId || '';
  const toName = params.toName || 'Friend';
  const maxAmountMinor = params.maxAmountMinor ? parseInt(params.maxAmountMinor, 10) : null;

  // Form state
  const [amountStr, setAmountStr] = useState(
    maxAmountMinor && maxAmountMinor > 0 ? (maxAmountMinor / 100).toString() : ''
  );
  const [method, setMethod] = useState<SettlementMethod>('UPI');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFillMax = () => {
    if (maxAmountMinor && maxAmountMinor > 0) {
      setAmountStr((maxAmountMinor / 100).toString());
      setError(null);
    }
  };

  const handleSubmit = async () => {
    const amountPaise = parseRupeesToPaise(amountStr);

    if (amountPaise <= 0) {
      setError('Please enter a settlement amount greater than zero.');
      return;
    }

    if (maxAmountMinor !== null && amountPaise > maxAmountMinor) {
      setError(`Settlement amount cannot exceed your current debt of ${formatMoney(maxAmountMinor)}.`);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const idempotencyKey = api.generateIdempotencyKey();
      const payload: SettlementCreateRequest = {
        to_user_id: toUserId,
        amount_minor: amountPaise,
        method,
        note: note.trim() ? note.trim() : null,
      };

      await api.post<SettlementRead>('/api/v1/settlements', payload, {
        idempotencyKey,
      });

      showToast(`Settlement of ${formatMoney(amountPaise)} recorded!`, 'success');
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace(toUserId ? `/balances/${toUserId}` : '/(tabs)/balances');
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen scrollable contentContainerStyle={styles.container}>
      <AppHeader
        title="Record Settlement"
        subtitle={`Repaying ${toName}`}
        showBack
      />

      <View style={styles.form}>
        {error ? (
          <View style={styles.errorAlert}>
            <Text style={styles.errorAlertText}>{error}</Text>
          </View>
        ) : null}

        {/* Amount Input */}
        <AmountInput
          value={amountStr}
          onChangeText={(text) => {
            setAmountStr(text);
            if (error) setError(null);
          }}
          placeholder="0"
        />

        {/* Max amount hint */}
        {maxAmountMinor && maxAmountMinor > 0 ? (
          <TouchableOpacity
            style={styles.maxHintContainer}
            onPress={handleFillMax}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.maxHintText}>
              Current debt: <Text style={styles.maxHintBold}>{formatMoney(maxAmountMinor)}</Text> (Tap to fill full balance)
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Payment Method Selector */}
        <View style={styles.methodContainer}>
          <Text style={styles.methodLabel}>Payment Method</Text>
          <SegmentedControl
            options={[
              { key: 'UPI', label: 'UPI / GPay' },
              { key: 'CASH', label: 'Cash' },
              { key: 'OTHER', label: 'Other' },
            ]}
            selectedKey={method}
            onSelect={(k) => setMethod(k as SettlementMethod)}
          />
        </View>

        {/* Note Field */}
        <FormField
          label="Note (Optional)"
          value={note}
          onChangeText={setNote}
          placeholder="e.g. Paid via UPI, Cash in hand"
          maxLength={160}
          helperText="Add a note or reference for your records."
        />

        <Button
          title="Confirm Settlement"
          onPress={handleSubmit}
          loading={isSubmitting}
          style={styles.submitBtn}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  form: {
    marginTop: spacing.sm,
  },
  errorAlert: {
    backgroundColor: colors.errorBg,
    borderRadius: radius.input,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorAlertText: {
    color: colors.error,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    textAlign: 'center',
  },
  maxHintContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  maxHintText: {
    fontSize: typography.size.xs,
    color: colors.primary,
  },
  maxHintBold: {
    fontWeight: typography.weight.bold,
  },
  methodContainer: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  methodLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  submitBtn: {
    marginTop: spacing.xl,
  },
});
