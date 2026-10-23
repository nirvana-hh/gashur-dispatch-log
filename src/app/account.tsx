import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Detail, DetailGrid } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useCanManage, useMe, useSession, useSyncStatus } from '@/hooks/use-session';
import { useTrips } from '@/hooks/use-store';
import { useTheme } from '@/hooks/use-theme';
import { formatDayTime, UrgencyColors } from '@/lib/calc';
import { confirmAction } from '@/lib/confirm';
import { signOut } from '@/lib/session';
import { loadDemoData } from '@/lib/store';
import { syncNow } from '@/lib/sync';

const PhaseText = {
  off: 'Not syncing',
  syncing: 'Syncing…',
  synced: 'Up to date',
  offline: "Offline: changes are saved on this device and will sync when it's back online",
} as const;

export default function AccountScreen() {
  const theme = useTheme();
  const session = useSession();
  const me = useMe();
  const canManage = useCanManage();
  const sync = useSyncStatus();
  const hasTrips = useTrips().length > 0;

  if (session.status !== 'signedIn') return null;

  function confirmSignOut() {
    const warning =
      sync.pending > 0
        ? `${sync.pending} change${sync.pending === 1 ? " hasn't" : "s haven't"} synced yet and will be lost.`
        : 'Company data will be removed from this device until you sign in again.';
    confirmAction('Sign out?', warning, 'Sign out', () => {
      void signOut();
    });
  }

  function confirmDemo() {
    confirmAction(
      'Load demo data?',
      'Adds a month of sample trips, trucks, drivers and clients to the company database for everyone.',
      'Load',
      () => {
        loadDemoData();
        router.back();
      },
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.container}>
      <Card>
        <DetailGrid>
          <Detail label="Name" value={me?.name || '—'} />
          <Detail label="Role" value={me ? (me.role === 'manager' ? 'Manager' : 'Dispatcher') : '—'} />
          <Detail label="Email" value={session.email} wide />
        </DetailGrid>
        {!canManage && (
          <Text style={[styles.note, { color: theme.textSecondary }]}>
            Dispatchers can add and edit records. Deleting and clearing fuel-loss flags need a manager.
          </Text>
        )}
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Sync</Text>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.dot,
              { backgroundColor: sync.phase === 'synced' && sync.pending === 0 ? UrgencyColors.ok : UrgencyColors.soon },
            ]}
          />
          <Text style={[styles.status, { color: theme.text }]}>{PhaseText[sync.phase]}</Text>
        </View>
        <DetailGrid>
          <Detail label="Waiting to sync" value={`${sync.pending} change${sync.pending === 1 ? '' : 's'}`} />
          <Detail label="Last synced" value={sync.lastSyncedAt ? formatDayTime(sync.lastSyncedAt) : '—'} />
        </DetailGrid>
        {sync.rejected && (
          <Text style={styles.rejected}>A change was refused by the server and undone: {sync.rejected}</Text>
        )}
        <Button label="Sync now" variant="secondary" onPress={syncNow} />
      </Card>

      <Button label="Change password" variant="secondary" onPress={() => router.push('/change-password')} />
      {canManage && <Button label="Manage staff" variant="secondary" onPress={() => router.push('/staff')} />}

      {canManage && !hasTrips && sync.phase === 'synced' && (
        <Button label="Load demo data" variant="secondary" onPress={confirmDemo} />
      )}

      <Button label="Sign out" variant="destructive" onPress={confirmSignOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  status: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  note: {
    fontSize: 13,
  },
  rejected: {
    color: '#EF4444',
    fontSize: 14,
  },
});
