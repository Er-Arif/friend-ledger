import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../components/ui/Screen';
import { AppHeader } from '../../components/ui/AppHeader';
import { AmountInput } from '../../components/ui/AmountInput';
import { FormField } from '../../components/ui/FormField';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { ParticipantSelector } from '../../components/ParticipantSelector';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { api } from '../../lib/apiClient';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import {
  PaymentCreateRequest,
  PaymentRead,
  SessionDetailResponse,
} from '../../types/api';
import { getFriendlyErrorMessage } from '../../lib/errors';
import { parseRupeesToPaise } from '../../utils/money';

export default function AddPaymentScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const user = useAuthStore((s) => s.user);
  const showToast = useToastStore((s) => s.show);

  const [session, setSession] = useState<SessionDetailResponse | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  // Form state
  const [amountStr, setAmountStr] = useState('');
  const [description, setDescription] = useState('');
  const [splitType, setSplitType] = useState<'EQUAL' | 'CUSTOM'>('EQUAL');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    let mounted = true;
    (async () => {
      try {
        const res = await api.get<SessionDetailResponse>(`/api/v1/sessions/${sessionId}`);
        if (mounted) {
          setSession(res);
          // Default: all participants selected
          const allIds = res.active_participants.map((p) => p.user_id);
          setSelectedUserIds(allIds);
        }
      } catch (err) {
        if (mounted) {
          setFormError(getFriendlyErrorMessage(err));
        }
      } finally {
        if (mounted) {
          setIsLoadingSession(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [sessionId]);

  const handleToggleUser = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      // Don't allow deselecting everyone
      if (selectedUserIds.length === 1) return;
      setSelectedUserIds(selectedUserIds.filter((id) => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const handleCustomAmountChange = (userId: string, val: string) => {
    setCustomAmounts((prev) => ({
      ...prev,
      [userId]: val,
    }));
  };

  const handleSubmit = async () => {
    const totalPaise = parseRupeesToPaise(amountStr);
    if (totalPaise <= 0) {
      setFormError('Please enter a valid amount greater than zero.');
      return;
    }

    if (!description.trim()) {
      setFormError('Please provide a description (e.g. Dinner, Drinks).');
      return;
    }

    if (selectedUserIds.length === 0) {
      setFormError('Please select at least one participant.');
      return;
    }

    // Must include someone other than current user
    const hasOtherParticipant = selectedUserIds.some((id) => id !== user?.id);
    if (!hasOtherParticipant) {
      setFormError('You cannot split a payment solely with yourself.');
      return;
    }

    let customSharesPayload = undefined;
    if (splitType === 'CUSTOM') {
      const customSum = selectedUserIds.reduce((sum, uid) => {
        return sum + parseRupeesToPaise(customAmounts[uid] || '0');
      }, 0);

      if (customSum !== totalPaise) {
        setFormError('The custom split amounts must equal the total amount exactly.');
        return;
      }

      customSharesPayload = selectedUserIds.map((uid) => ({
        user_id: uid,
        amount_minor: parseRupeesToPaise(customAmounts[uid] || '0'),
      }));
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      const idempotencyKey = api.generateIdempotencyKey();
      const payload: PaymentCreateRequest = {
        description: description.trim(),
        total_amount_minor: totalPaise,
        split_type: splitType,
        participant_user_ids: selectedUserIds,
        custom_shares: customSharesPayload,
      };

      await api.post<PaymentRead>(
        `/api/v1/sessions/${sessionId}/payments`,
        payload,
        { idempotencyKey }
      );

      showToast('Payment recorded successfully!', 'success');
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace(sessionId ? `/outings/${sessionId}` : '/(tabs)/outings');
      }
    } catch (err) {
      setFormError(getFriendlyErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingSession) {
    return (
      <Screen>
        <LoadingState message="Loading participants..." />
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen>
        <ErrorState
          title="Outing not found"
          message={formError || 'Could not load outing participants'}
          onRetry={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/outings');
            }
          }}
        />
      </Screen>
    );
  }

  const totalPaise = parseRupeesToPaise(amountStr);

  return (
    <Screen scrollable contentContainerStyle={styles.container}>
      <AppHeader
        title="Add Payment"
        subtitle={session.name || 'Outing Payment'}
        showBack
      />

      <View style={styles.form}>
        {formError ? (
          <View style={styles.errorAlert}>
            <Text style={styles.errorAlertText}>{formError}</Text>
          </View>
        ) : null}

        {/* Amount Input */}
        <AmountInput
          value={amountStr}
          onChangeText={(text) => {
            setAmountStr(text);
            if (formError) setFormError(null);
          }}
          placeholder="0"
        />

        {/* Description Field */}
        <FormField
          label="What was this for?"
          value={description}
          onChangeText={(text) => {
            setDescription(text);
            if (formError) setFormError(null);
          }}
          placeholder="e.g. Dinner, Drinks, Cab, Groceries"
          maxLength={120}
        />

        {/* Split Type Selector */}
        <View style={styles.splitToggleContainer}>
          <Text style={styles.splitToggleLabel}>Split Method</Text>
          <SegmentedControl
            options={[
              { key: 'EQUAL', label: 'Split Equally' },
              { key: 'CUSTOM', label: 'Custom Split' },
            ]}
            selectedKey={splitType}
            onSelect={(k) => setSplitType(k as 'EQUAL' | 'CUSTOM')}
          />
        </View>

        {/* Participant Selection */}
        <ParticipantSelector
          participants={session.active_participants}
          currentUserId={user?.id || ''}
          splitType={splitType}
          selectedUserIds={selectedUserIds}
          onToggleUser={handleToggleUser}
          customAmounts={customAmounts}
          onChangeCustomAmount={handleCustomAmountChange}
          totalAmountMinor={totalPaise}
        />

        {/* Submit Button */}
        <Button
          title="Record Payment"
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
  splitToggleContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  splitToggleLabel: {
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
