import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../components/ui/Screen';
import { AppHeader } from '../../components/ui/AppHeader';
import { QRCard } from '../../components/ui/QRCard';
import { Button } from '../../components/ui/Button';
import { spacing } from '../../constants/spacing';

export default function OutingQRScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string; name?: string }>();

  const joinCode = params.code || '';
  const name = params.name || 'Outing';

  return (
    <Screen scrollable contentContainerStyle={styles.container}>
      <AppHeader
        title={name}
        subtitle="Invite friends to join"
        showBack
      />

      <View style={styles.content}>
        <QRCard joinCode={joinCode} outingName={name} />

        <Button
          title="Done"
          variant="secondary"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/outings'))}
          style={styles.doneBtn}
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
    alignItems: 'stretch',
  },
  doneBtn: {
    marginTop: spacing.xl,
  },
});
