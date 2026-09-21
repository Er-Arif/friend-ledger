import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { colors } from '../../constants/colors';
import { radius } from '../../constants/radius';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { encodeOutingQR } from '../../utils/qr';

interface QRCardProps {
  joinCode: string;
  outingName?: string | null;
}

export const QRCard: React.FC<QRCardProps> = ({ joinCode, outingName }) => {
  const [copied, setCopied] = useState(false);
  const qrValue = encodeOutingQR(joinCode, outingName);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <View style={styles.container}>
      <View style={styles.qrContainer}>
        <QRCode
          value={qrValue}
          size={200}
          color="#000000"
          backgroundColor="#FFFFFF"
        />
      </View>

      <Text style={styles.helperText}>Ask friends to scan this code to join</Text>

      <View style={styles.codeContainer}>
        <Text style={styles.codeLabel}>JOIN CODE</Text>
        <Text style={styles.codeText}>{joinCode}</Text>

        <TouchableOpacity
          style={styles.copyButton}
          onPress={handleCopy}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Copy join code to clipboard"
        >
          <Ionicons
            name={copied ? 'checkmark-circle' : 'copy-outline'}
            size={18}
            color={copied ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.copyText, copied && styles.copyTextSuccess]}>
            {copied ? 'Copied!' : 'Copy Code'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  qrContainer: {
    padding: spacing.base,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    marginBottom: spacing.base,
  },
  helperText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  codeContainer: {
    alignItems: 'center',
    width: '100%',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  codeLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  codeText: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    letterSpacing: 4,
    marginBottom: spacing.md,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    borderRadius: radius.button,
    gap: spacing.xs,
  },
  copyText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
  },
  copyTextSuccess: {
    color: colors.primary,
  },
});
