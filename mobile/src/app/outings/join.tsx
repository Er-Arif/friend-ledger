import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/ui/Screen';
import { AppHeader } from '../../components/ui/AppHeader';
import { FormField } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { api } from '../../lib/apiClient';
import { SessionJoinRequest, SessionJoinResponse } from '../../types/api';
import { useToastStore } from '../../stores/toastStore';
import { getFriendlyErrorMessage } from '../../lib/errors';
import { validateJoinCode } from '../../utils/validation';

export default function JoinOutingScreen() {
  const router = useRouter();
  const showToast = useToastStore((s) => s.show);

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    const validationError = validateJoinCode(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const payload: SessionJoinRequest = { join_code: trimmed };
      const res = await api.post<SessionJoinResponse>('/api/v1/sessions/join', payload);
      showToast(`Joined ${res.session.name || 'outing'}!`, 'success');
      router.replace(`/outings/${res.session.id}`);
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen scrollable contentContainerStyle={styles.container}>
      <AppHeader
        title="Join Outing"
        subtitle="Enter the 6-character code or scan QR"
        showBack
      />

      <View style={styles.content}>
        {error ? (
          <View style={styles.errorAlert}>
            <Text style={styles.errorAlertText}>{error}</Text>
          </View>
        ) : null}

        {/* Scan Camera QR Button */}
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => router.push('/outings/scan')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Scan QR Code"
        >
          <View style={styles.scanIconWrapper}>
            <Ionicons name="camera-outline" size={28} color={colors.primary} />
          </View>
          <View style={styles.scanTextWrapper}>
            <Text style={styles.scanTitle}>{"Scan Friend's QR Code"}</Text>
            <Text style={styles.scanSubtitle}>Quickly join using your camera</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR ENTER CODE</Text>
          <View style={styles.dividerLine} />
        </View>

        <FormField
          label="6-Character Join Code"
          value={code}
          onChangeText={(text) => {
            setCode(text.toUpperCase());
            if (error) setError(null);
          }}
          placeholder="e.g. 7K4P9X"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          helperText="Ask the person who started the outing for their code."
          style={styles.codeInput}
        />

        <Button
          title="Join Outing"
          onPress={handleJoin}
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
  content: {
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
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    marginBottom: spacing.lg,
  },
  scanIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.owedToMeBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  scanTextWrapper: {
    flex: 1,
  },
  scanTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  scanSubtitle: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    letterSpacing: 0.8,
  },
  codeInput: {
    letterSpacing: 4,
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: typography.size.xl,
  },
  submitBtn: {
    marginTop: spacing.lg,
  },
});
