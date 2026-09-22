import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Screen } from '../../components/ui/Screen';
import { AppHeader } from '../../components/ui/AppHeader';
import { Avatar } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FormField } from '../../components/ui/FormField';
import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { api } from '../../lib/apiClient';
import { getFriendlyErrorMessage } from '../../lib/errors';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import { User } from '../../types/api';
import { formatDate } from '../../utils/dates';
import { validateUpiId } from '../../utils/upi';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const showToast = useToastStore((s) => s.show);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // UPI configuration state
  const [isEditingUpi, setIsEditingUpi] = useState(false);
  const [upiInput, setUpiInput] = useState('');
  const [upiError, setUpiError] = useState<string | null>(null);
  const [isSavingUpi, setIsSavingUpi] = useState(false);

  const handleStartEditUpi = () => {
    setUpiInput(user?.upi_id || '');
    setUpiError(null);
    setIsEditingUpi(true);
  };

  const handleSaveUpi = async () => {
    const trimmed = upiInput.trim();
    if (trimmed) {
      const err = validateUpiId(trimmed);
      if (err) {
        setUpiError(err);
        return;
      }
    }

    setIsSavingUpi(true);
    setUpiError(null);
    try {
      const updatedUser = await api.patch<User>('/api/v1/me/upi', {
        upi_id: trimmed || null,
      });
      useAuthStore.getState().setUser(updatedUser);
      setIsEditingUpi(false);
      showToast(
        trimmed ? 'UPI ID updated successfully' : 'UPI ID removed',
        'success'
      );
    } catch (err) {
      setUpiError(getFriendlyErrorMessage(err));
    } finally {
      setIsSavingUpi(false);
    }
  };

  const handleCopyUserId = async () => {
    if (user?.id) {
      await Clipboard.setStringAsync(user.id);
      showToast('User ID copied to clipboard', 'info');
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      setShowLogoutConfirm(false);
      showToast('Signed out successfully', 'info');
      router.replace('/(auth)/login');
    } catch {
      setShowLogoutConfirm(false);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <Screen scrollable contentContainerStyle={styles.container}>
      <AppHeader title="Profile" />

      {/* User Card */}
      <View style={styles.userCard}>
        <Avatar name={user?.display_name || 'User'} size={72} />
        <Text style={styles.displayName}>{user?.display_name}</Text>
        <Text style={styles.username}>@{user?.username}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>ACTIVE ACCOUNT</Text>
        </View>
      </View>

      {/* Account Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Details</Text>
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Display Name</Text>
            <Text style={styles.infoValue}>{user?.display_name}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Username</Text>
            <Text style={styles.infoValue}>@{user?.username}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Member Since</Text>
            <Text style={styles.infoValue}>
              {user?.created_at ? formatDate(user.created_at) : '—'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>User ID</Text>
            <Text
              style={[styles.infoValue, styles.idValue]}
              numberOfLines={1}
              onPress={handleCopyUserId}
            >
              {user?.id ? `${user.id.slice(0, 8)}...` : '—'}
            </Text>
          </View>
        </Card>
      </View>

      {/* Payment Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Details</Text>
        <Card style={styles.infoCard}>
          {!isEditingUpi ? (
            <View style={styles.upiRow}>
              <View style={styles.upiTextContainer}>
                <Text style={styles.infoLabel}>UPI ID</Text>
                <Text style={[styles.infoValue, !user?.upi_id && styles.unsetUpiText]}>
                  {user?.upi_id || 'Not configured'}
                </Text>
              </View>
              <Button
                title={user?.upi_id ? 'Edit' : 'Add UPI ID'}
                variant={user?.upi_id ? 'outline' : 'primary'}
                size="small"
                onPress={handleStartEditUpi}
              />
            </View>
          ) : (
            <View style={styles.editUpiContainer}>
              <FormField
                label="UPI ID"
                value={upiInput}
                onChangeText={(text) => {
                  setUpiInput(text);
                  if (upiError) setUpiError(null);
                }}
                placeholder="e.g. arif@okaxis"
                autoCapitalize="none"
                autoCorrect={false}
                error={upiError || undefined}
                helperText="Used to generate payment QR codes so friends can settle debts."
              />
              <View style={styles.upiActionRow}>
                <Button
                  title="Cancel"
                  variant="outline"
                  size="small"
                  onPress={() => setIsEditingUpi(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Save"
                  variant="primary"
                  size="small"
                  loading={isSavingUpi}
                  onPress={handleSaveUpi}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          )}
        </Card>
      </View>

      {/* App Principles */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About Friend Ledger</Text>
        <Card style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>Explainable Pairwise Balances</Text>
          <Text style={styles.aboutText}>
            Friend Ledger calculates balances strictly between you and each individual friend.
            No transitive debt simplification is performed, so every rupee owed can always be
            traced back to specific outing payments and settlements.
          </Text>
        </Card>
      </View>

      {/* Logout Button */}
      <View style={styles.logoutSection}>
        <Button
          title="Sign Out"
          variant="destructive"
          onPress={() => setShowLogoutConfirm(true)}
        />
      </View>

      <ConfirmDialog
        visible={showLogoutConfirm}
        title="Sign Out"
        message="Are you sure you want to sign out of Friend Ledger?"
        confirmLabel="Sign Out"
        isDestructive
        isLoading={isLoggingOut}
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  userCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  displayName: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  username: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: colors.owedToMeBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginTop: spacing.md,
  },
  statusBadgeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.owedToMe,
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  infoCard: {
    padding: spacing.base,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  infoLabel: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.textPrimary,
  },
  idValue: {
    color: colors.primary,
    fontFamily: 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  aboutCard: {
    padding: spacing.base,
    backgroundColor: colors.surfaceSecondary,
  },
  aboutTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  aboutText: {
    fontSize: typography.size.xs,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  logoutSection: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  upiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  upiTextContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  unsetUpiText: {
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  editUpiContainer: {
    paddingVertical: spacing.xs,
  },
  upiActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
