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
import { validatePassword, validateUsername } from '../../utils/validation';

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const showToast = useToastStore((s) => s.show);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ username?: string | null; password?: string | null; general?: string | null }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    const usernameError = validateUsername(username);
    const passwordError = validatePassword(password);

    if (usernameError || passwordError) {
      setErrors({
        username: usernameError,
        password: passwordError,
        general: null,
      });
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      await login({
        username: username.trim(),
        password,
      });
      showToast('Welcome back!', 'success');
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
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to view your balances and outings</Text>
      </View>

      <View style={styles.form}>
        {errors.general ? (
          <View style={styles.errorAlert}>
            <Text style={styles.errorAlertText}>{errors.general}</Text>
          </View>
        ) : null}

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
          autoComplete="username"
        />

        <FormField
          label="Password"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (errors.password) setErrors((e) => ({ ...e, password: null }));
          }}
          placeholder="••••••••"
          secureTextEntry
          error={errors.password}
          autoComplete="password"
        />

        <Button
          title="Sign In"
          onPress={handleLogin}
          loading={isSubmitting}
          style={styles.submitButton}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{"Don't have an account? "}</Text>
        <TouchableOpacity
          onPress={() => router.push('/(auth)/register')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.footerLink}>Create one</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  brandBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
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
    marginBottom: spacing.xl,
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
    marginTop: spacing.lg,
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
