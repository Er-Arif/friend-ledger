import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../components/ui/Screen';
import { FormField } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import { getFriendlyErrorMessage } from '../../lib/errors';
import {
  validateDisplayName,
  validatePassword,
  validateUsername,
} from '../../utils/validation';

export default function RegisterScreen() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const showToast = useToastStore((s) => s.show);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{
    displayName?: string | null;
    username?: string | null;
    password?: string | null;
    confirmPassword?: string | null;
    general?: string | null;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async () => {
    const nameError = validateDisplayName(displayName);
    const usernameError = validateUsername(username);
    const passwordError = validatePassword(password);
    let confirmError: string | null = null;

    if (password !== confirmPassword) {
      confirmError = 'Passwords do not match.';
    }

    if (nameError || usernameError || passwordError || confirmError) {
      setErrors({
        displayName: nameError,
        username: usernameError,
        password: passwordError,
        confirmPassword: confirmError,
        general: null,
      });
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      await register({
        display_name: displayName.trim(),
        username: username.trim(),
        password,
      });
      showToast('Account created successfully!', 'success');
      router.replace('/(tabs)');
    } catch (err) {
      const msg = getFriendlyErrorMessage(err);
      setErrors({ general: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen scrollable contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.brandBadge}>
          <Text style={styles.brandBadgeText}>FL</Text>
        </View>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>
          Keep track of shared spending effortlessly
        </Text>
      </View>

      <View style={styles.form}>
        {errors.general ? (
          <View style={styles.errorAlert}>
            <Text style={styles.errorAlertText}>{errors.general}</Text>
          </View>
        ) : null}

        <FormField
          label="Your Name"
          value={displayName}
          onChangeText={(text) => {
            setDisplayName(text);
            if (errors.displayName) setErrors((e) => ({ ...e, displayName: null }));
          }}
          placeholder="e.g. Arif Ali"
          error={errors.displayName}
          autoCapitalize="words"
        />

        <FormField
          label="Username"
          value={username}
          onChangeText={(text) => {
            setUsername(text);
            if (errors.username) setErrors((e) => ({ ...e, username: null }));
          }}
          placeholder="e.g. arif_ali"
          autoCapitalize="none"
          error={errors.username}
          helperText="Letters, numbers, and underscores only"
        />

        <FormField
          label="Password"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (errors.password) setErrors((e) => ({ ...e, password: null }));
          }}
          placeholder="At least 8 characters"
          secureTextEntry
          error={errors.password}
        />

        <FormField
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={(text) => {
            setConfirmPassword(text);
            if (errors.confirmPassword) {
              setErrors((e) => ({ ...e, confirmPassword: null }));
            }
          }}
          placeholder="Repeat your password"
          secureTextEntry
          error={errors.confirmPassword}
        />

        <Button
          title="Create Account"
          onPress={handleRegister}
          loading={isSubmitting}
          style={styles.submitButton}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{"Already have an account? "}</Text>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/login'))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.footerLink}>Sign in</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  brandBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  brandBadgeText: {
    fontSize: 22,
    fontWeight: typography.weight.heavy,
    color: colors.textInverse,
    letterSpacing: 1,
  },
  title: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  form: {
    marginBottom: spacing.lg,
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
  submitButton: {
    marginTop: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  footerText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  footerLink: {
    fontSize: typography.size.sm,
    color: colors.primary,
    fontWeight: typography.weight.semibold,
  },
});
