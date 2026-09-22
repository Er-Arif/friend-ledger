import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { useAuthStore } from '../stores/authStore';
import { Toast } from '../components/ui/Toast';
import { realtime } from '../lib/realtime';

export default function RootLayout() {
  const { isAuthenticated, isLoading, initialize } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (isAuthenticated) {
      realtime.connect();
    } else {
      realtime.disconnect();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View style={styles.splashContainer}>
        <StatusBar style="dark" />
        <View style={styles.brandIcon}>
          <Text style={styles.brandIconText}>FL</Text>
        </View>
        <Text style={styles.brandTitle}>Friend Ledger</Text>
        <Text style={styles.brandSubtitle}>Shared payments between friends</Text>
        <ActivityIndicator
          size="small"
          color={colors.primary}
          style={styles.spinner}
        />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen
          name="outings/start"
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen
          name="outings/join"
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen
          name="outings/scan"
          options={{ presentation: 'fullScreenModal', headerShown: false }}
        />
        <Stack.Screen
          name="outings/qr"
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen name="outings/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="payments/add"
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen name="payments/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="balances/[userId]" options={{ headerShown: false }} />
        <Stack.Screen
          name="settlements/record"
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen name="settlements/[id]" options={{ headerShown: false }} />
      </Stack>
      <Toast />
    </>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  brandIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  brandIconText: {
    fontSize: 24,
    fontWeight: typography.weight.heavy,
    color: colors.textInverse,
    letterSpacing: 1,
  },
  brandTitle: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  spinner: {
    marginTop: spacing.xxl,
  },
});
