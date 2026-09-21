import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/ui/Screen';
import { Button } from '../../components/ui/Button';
import { colors } from '../../constants/colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { api } from '../../lib/apiClient';
import { SessionJoinRequest, SessionJoinResponse } from '../../types/api';
import { useToastStore } from '../../stores/toastStore';
import { getFriendlyErrorMessage } from '../../lib/errors';
import { decodeOutingQR } from '../../utils/qr';

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const showToast = useToastStore((s) => s.show);

  const [scanned, setScanned] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  if (!permission) {
    return (
      <Screen>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen contentContainerStyle={styles.permissionContainer}>
        <View style={styles.permissionCard}>
          <Ionicons name="camera-outline" size={48} color={colors.primary} />
          <Text style={styles.permissionTitle}>Camera Permission</Text>
          <Text style={styles.permissionMessage}>
            Friend Ledger requires camera access to scan outing QR codes.
          </Text>
          <Button
            title="Grant Permission"
            onPress={requestPermission}
            style={styles.permissionBtn}
          />
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/outings/join'))}
          >
            <Text style={styles.cancelBtnText}>Enter Code Manually Instead</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  const handleBarCodeScanned = async (data: string) => {
    if (scanned || isJoining) return;
    setScanned(true);

    const result = decodeOutingQR(data);
    if (!result) {
      showToast('Unrecognized QR code format. Please try again.', 'error');
      setTimeout(() => setScanned(false), 2000);
      return;
    }

    setIsJoining(true);
    try {
      const payload: SessionJoinRequest = { join_code: result.join_code };
      const res = await api.post<SessionJoinResponse>('/api/v1/sessions/join', payload);
      showToast(`Joined ${res.session.name || 'outing'}!`, 'success');
      router.replace(`/outings/${res.session.id}`);
    } catch (err) {
      showToast(getFriendlyErrorMessage(err), 'error');
      setTimeout(() => {
        setScanned(false);
        setIsJoining(false);
      }, 2500);
    }
  };

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        <View style={styles.webFallback}>
          <Ionicons name="camera-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.webFallbackTitle}>Camera scanning unavailable in web view</Text>
          <Text style={styles.webFallbackSub}>Please enter the 6-character code manually.</Text>
          <Button
            title="Enter Join Code"
            onPress={() => router.replace('/outings/join')}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      ) : (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={scanned ? undefined : ({ data }) => handleBarCodeScanned(data)}
        >
          {/* Scanner Overlay */}
          <View style={styles.overlay}>
            <View style={styles.topBar}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/outings/join'))}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.topBarTitle}>Scan Outing QR</Text>
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.scanFrameContainer}>
              <View style={styles.scanTargetBox}>
                {/* Corner markers */}
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />

                {isJoining && (
                  <View style={styles.joiningLoadingBox}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                    <Text style={styles.joiningLoadingText}>Joining outing...</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.bottomBar}>
              <Text style={styles.instructionText}>
                Point your camera at a Friend Ledger outing QR code
              </Text>
              <TouchableOpacity
                style={styles.manualEntryLink}
                onPress={() => router.replace('/outings/join')}
              >
                <Text style={styles.manualEntryLinkText}>Enter code manually</Text>
              </TouchableOpacity>
            </View>
          </View>
        </CameraView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  permissionTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  permissionMessage: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  permissionBtn: {
    width: '100%',
  },
  cancelBtn: {
    marginTop: spacing.md,
    padding: spacing.xs,
  },
  cancelBtnText: {
    color: colors.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  webFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  webFallbackTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  webFallbackSub: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: spacing.base,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: '#FFFFFF',
  },
  scanFrameContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTargetBox: {
    width: 250,
    height: 250,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: colors.primary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  joiningLoadingBox: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: radius.card,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  joiningLoadingText: {
    color: '#FFFFFF',
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  bottomBar: {
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 48 : 28,
    paddingHorizontal: spacing.xl,
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  manualEntryLink: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  manualEntryLinkText: {
    color: '#FFFFFF',
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    textDecorationLine: 'underline',
  },
});
