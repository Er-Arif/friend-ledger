import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../components/ui/Screen';
import { AppHeader } from '../../components/ui/AppHeader';
import { FormField } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { api } from '../../lib/apiClient';
import { SessionCreateRequest, SessionCreateResponse } from '../../types/api';
import { useToastStore } from '../../stores/toastStore';
import { getFriendlyErrorMessage } from '../../lib/errors';

export default function StartOutingScreen() {
  const router = useRouter();
  const showToast = useToastStore((s) => s.show);

  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStartOuting = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: SessionCreateRequest = {
        name: name.trim() ? name.trim() : null,
      };

      const response = await api.post<SessionCreateResponse>('/api/v1/sessions', payload);
      showToast('Outing started!', 'success');
      router.replace(`/outings/${response.id}`);
    } catch (err) {
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen scrollable contentContainerStyle={styles.container}>
      <AppHeader
        title="Start Outing"
        subtitle="Create a shared session for spending"
        showBack
      />

      <View style={styles.form}>
        {errorMessage ? (
          <View style={styles.errorAlert}>
            <Text style={styles.errorAlertText}>{errorMessage}</Text>
          </View>
        ) : null}

        <FormField
          label="Outing Name (Optional)"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Dinner at Olive, Weekend Trip, Chai"
          autoFocus
          maxLength={80}
          helperText="Give your outing a recognizable name, or leave blank."
        />

        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>How it works</Text>
          <Text style={styles.infoText}>
            • A 6-character join code and QR code are instantly generated.
            {'\n'}• Friends join using the code or by scanning your screen.
            {'\n'}• Anyone in the outing can log payments made for the group.
            {'\n'}• Balances are computed in real time and updated directly between participants.
          </Text>
        </Card>

        <Button
          title="Start Outing"
          onPress={handleStartOuting}
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
    marginTop: spacing.md,
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
  infoCard: {
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.base,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  infoTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  infoText: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  submitBtn: {
    marginTop: spacing.sm,
  },
});
