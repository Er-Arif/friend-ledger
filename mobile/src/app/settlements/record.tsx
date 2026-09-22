import React, { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/ui/Screen';
import { AppHeader } from '../../components/ui/AppHeader';
import { AmountInput } from '../../components/ui/AmountInput';
import { FormField } from '../../components/ui/FormField';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { UPIPaymentQR } from '../../components/UPIPaymentQR';
import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { api } from '../../lib/apiClient';
import { useToastStore } from '../../stores/toastStore';
import { PairwiseBalanceResponse, SettlementCreateRequest, SettlementMethod, SettlementRead } from '../../types/api';
import { getFriendlyErrorMessage } from '../../lib/errors';
import { formatMoney, parseRupeesToPaise } from '../../utils/money';
import { buildUpiPaymentUri } from '../../utils/upi';

export default function RecordSettlementScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    toUserId: string;
    toName?: string;
    maxAmountMinor?: string;
    counterpartyUpiId?: string;
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

  // UPI State
  const [counterpartyUpiId, setCounterpartyUpiId] = useState<string | null>(
    params.counterpartyUpiId || null
  );
  const [launchedUpi, setLaunchedUpi] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [upiLaunchError, setUpiLaunchError] = useState(false);
  const [showUpiQr, setShowUpiQr] = useState(false);
  const [upiCopied, setUpiCopied] = useState(false);

  // If counterparty UPI ID not in route params, fetch balance detail to check
  useEffect(() => {
    if (counterpartyUpiId || !toUserId) return;
    let mounted = true;
    (async () => {
      try {
        const res = await api.get<PairwiseBalanceResponse>(`/api/v1/me/balances/${toUserId}`);
        if (mounted && res.counterparty_upi_id) {
          setCounterpartyUpiId(res.counterparty_upi_id);
        }
      } catch {
        // Non-blocking fallback
      }
    })();
    return () => {
      mounted = false;
    };
  }, [counterpartyUpiId, toUserId]);

  // Handle returning from external UPI application
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && launchedUpi) {
        setPendingConfirmation(true);
      }
    });
    return () => sub.remove();
  }, [launchedUpi]);

  const handleFillMax = () => {
    if (maxAmountMinor && maxAmountMinor > 0) {
      setAmountStr((maxAmountMinor / 100).toString());
      setError(null);
    }
  };

  const amountPaise = parseRupeesToPaise(amountStr);

  const handleLaunchUpi = async () => {
    if (amountPaise <= 0) {
      setError('Please enter a settlement amount greater than zero.');
      return;
    }
    if (maxAmountMinor !== null && amountPaise > maxAmountMinor) {
      setError(`Settlement amount cannot exceed your current debt of ${formatMoney(maxAmountMinor)}.`);
      return;
    }
    if (!counterpartyUpiId) {
      setError(`${toName} hasn't added a UPI ID yet.`);
      return;
    }

    setError(null);
    setUpiLaunchError(false);

    const uri = buildUpiPaymentUri({
      payeeUpiId: counterpartyUpiId,
      payeeName: toName,
      amountMinor: amountPaise,
      transactionNote: note.trim() || 'Friend Ledger settlement',
    });

    try {
      setLaunchedUpi(true);
      await Linking.openURL(uri);
      setPendingConfirmation(true);
    } catch {
      setUpiLaunchError(true);
      setPendingConfirmation(true);
    }
  };

  const handleCopyUpi = async () => {
    if (!counterpartyUpiId) return;
    await Clipboard.setStringAsync(counterpartyUpiId);
    setUpiCopied(true);
    setTimeout(() => setUpiCopied(false), 2500);
    showToast(`UPI ID ${counterpartyUpiId} copied!`, 'info');
  };

  const handleSubmit = async () => {
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
            onSelect={(k) => {
              setMethod(k as SettlementMethod);
              setPendingConfirmation(false);
            }}
          />
        </View>

        {/* Note Field */}
        <FormField
          label="Note (Optional)"
          value={note}
          onChangeText={setNote}
          placeholder="e.g. Paid via UPI, Cash in hand"
          maxLength={160}
          helperText="Add a reference or description for your records."
        />

        {/* UPI-Specific Flow */}
        {method === 'UPI' && (
          <View style={styles.upiSection}>
            {counterpartyUpiId ? (
              <>
                <Card style={styles.upiDetailsCard}>
                  <View style={styles.upiDetailRow}>
                    <Text style={styles.upiDetailLabel}>Recipient</Text>
                    <Text style={styles.upiDetailValue}>{toName}</Text>
                  </View>
                  <View style={styles.upiDetailRow}>
                    <Text style={styles.upiDetailLabel}>UPI ID</Text>
                    <Text style={[styles.upiDetailValue, styles.upiVpaValue]}>
                      {counterpartyUpiId}
                    </Text>
                  </View>
                  <View style={styles.upiDetailRow}>
                    <Text style={styles.upiDetailLabel}>Amount</Text>
                    <Text style={[styles.upiDetailValue, styles.upiAmountValue]}>
                      {formatMoney(amountPaise)}
                    </Text>
                  </View>
                </Card>

                {/* Primary Pay Action */}
                {!pendingConfirmation ? (
                  <Button
                    title={`Pay ${formatMoney(amountPaise)} via UPI`}
                    icon={<Ionicons name="open-outline" size={18} color={colors.textInverse} style={{ marginRight: 6 }} />}
                    onPress={handleLaunchUpi}
                    disabled={amountPaise <= 0}
                    style={styles.payUpiBtn}
                  />
                ) : null}

                {/* Fallback & Helper */}
                {upiLaunchError ? (
                  <View style={styles.fallbackNotice}>
                    <Text style={styles.fallbackTitle}>Could not open UPI app directly</Text>
                    <Text style={styles.fallbackText}>
                      No compatible UPI app responded on this device. You can copy the UPI ID or scan
                      the payment QR code manually:
                    </Text>
                    <View style={styles.fallbackActions}>
                      <Button
                        title={upiCopied ? 'UPI ID Copied' : 'Copy UPI ID'}
                        variant="outline"
                        size="small"
                        onPress={handleCopyUpi}
                        style={{ flex: 1 }}
                      />
                      <Button
                        title={showUpiQr ? 'Hide QR' : 'Show QR'}
                        variant="outline"
                        size="small"
                        onPress={() => setShowUpiQr(!showUpiQr)}
                        style={{ flex: 1 }}
                      />
                    </View>
                  </View>
                ) : null}

                {/* Optional QR Display */}
                {showUpiQr && (
                  <View style={{ marginTop: spacing.md }}>
                    <UPIPaymentQR
                      payeeUpiId={counterpartyUpiId}
                      payeeName={toName}
                      amountMinor={amountPaise}
                      transactionNote={note.trim() || 'Friend Ledger settlement'}
                    />
                  </View>
                )}

                {/* Confirmation Step */}
                {pendingConfirmation ? (
                  <Card style={styles.confirmationCard}>
                    <View style={styles.confirmHeader}>
                      <Ionicons name="help-circle" size={32} color={colors.primary} />
                      <Text style={styles.confirmTitle}>Did you complete the payment?</Text>
                      <Text style={styles.confirmSub}>
                        {formatMoney(amountPaise)} to {toName}
                      </Text>
                    </View>

                    <Text style={styles.confirmExplanation}>
                      Only tap confirm after completing the payment in your UPI app.
                      This records the repayment on your shared ledger.
                    </Text>

                    <View style={styles.confirmActionRow}>
                      <Button
                        title="Not Yet"
                        variant="outline"
                        onPress={() => setPendingConfirmation(false)}
                        style={{ flex: 1 }}
                      />
                      <Button
                        title="Confirm Settlement"
                        variant="primary"
                        loading={isSubmitting}
                        onPress={handleSubmit}
                        style={{ flex: 1 }}
                      />
                    </View>
                  </Card>
                ) : (
                  <TouchableOpacity
                    style={styles.manualSettleLink}
                    onPress={() => setPendingConfirmation(true)}
                  >
                    <Text style={styles.manualSettleText}>
                      Already paid? Confirm settlement manually
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.noUpiCard}>
                <Text style={styles.noUpiTitle}>{`${toName} hasn't added a UPI ID yet.`}</Text>
                <Text style={styles.noUpiText}>
                  If you paid {toName} outside Friend Ledger, you can still record and confirm your
                  settlement below.
                </Text>
                <Button
                  title="Confirm Settlement"
                  variant="primary"
                  loading={isSubmitting}
                  onPress={handleSubmit}
                  style={styles.submitBtn}
                />
              </View>
            )}
          </View>
        )}

        {/* Non-UPI Confirmation Button */}
        {method !== 'UPI' && (
          <Button
            title="Confirm Settlement"
            onPress={handleSubmit}
            loading={isSubmitting}
            style={styles.submitBtn}
          />
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
  upiSection: {
    marginTop: spacing.xs,
  },
  upiDetailsCard: {
    padding: spacing.base,
    backgroundColor: colors.surfaceSecondary,
    marginBottom: spacing.md,
  },
  upiDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  upiDetailLabel: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    fontWeight: typography.weight.medium,
  },
  upiDetailValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  upiVpaValue: {
    fontFamily: 'monospace',
    color: colors.primary,
  },
  upiAmountValue: {
    color: colors.iOwe,
  },
  payUpiBtn: {
    marginBottom: spacing.md,
  },
  confirmationCard: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderWidth: 1.5,
    marginTop: spacing.sm,
  },
  confirmHeader: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  confirmTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  confirmSub: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.primary,
    marginTop: 2,
    textAlign: 'center',
  },
  confirmExplanation: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  confirmActionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  manualSettleLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  manualSettleText: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  fallbackNotice: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fallbackTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  fallbackText: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: spacing.sm,
  },
  fallbackActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  noUpiCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.card,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noUpiTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  noUpiText: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  submitBtn: {
    marginTop: spacing.md,
  },
});
