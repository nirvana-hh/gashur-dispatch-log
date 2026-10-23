import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AlertList } from '@/components/alert-list';
import { Card, EmptyText, Section } from '@/components/ui';
import { Accent, Spacing } from '@/constants/theme';
import { useStaffName } from '@/hooks/use-session';
import { useDrivers, useNotifications, useReadAt, useTrucks } from '@/hooks/use-store';
import { useTheme } from '@/hooks/use-theme';
import { driverAlerts, formatDayTime, truckAlerts, UrgencyColors } from '@/lib/calc';
import { markAllRead, type NotificationKind } from '@/lib/store';

const KindColors: Record<NotificationKind, string> = {
  dispatched: '#3B82F6',
  delivered: '#0EA5E9',
  billed: '#F59E0B',
  paid: '#22C55E',
  loss: UrgencyColors.overdue,
};

export default function NotificationsScreen() {
  const theme = useTheme();
  const notifications = useNotifications();
  const compliance = [...driverAlerts(useDrivers()), ...truckAlerts(useTrucks())];

  const staffName = useStaffName();
  // Opening the list counts as reading it; unread dots, judged against the read time
  // when the list opened, stay visible until it closes.
  const readAt = useReadAt();
  const [readAtOnOpen] = useState(readAt);
  useEffect(() => markAllRead, []);

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.container}>
      <Section title="Compliance reminders">
        <Card>
          <AlertList alerts={compliance} empty="Nothing due in the next 30 days." />
        </Card>
      </Section>

      <Section title="Trip activity">
        {notifications.length === 0 && <EmptyText>No activity yet.</EmptyText>}
        {notifications.map((n) => (
          <Pressable
            key={n.id}
            onPress={() => router.push({ pathname: '/trips/[id]', params: { id: n.tripId } })}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
            ]}>
            <View style={[styles.kind, { backgroundColor: KindColors[n.kind] }]} />
            <View style={styles.text}>
              <Text style={[styles.title, { color: theme.text }]}>{n.title}</Text>
              <Text style={[styles.body, { color: theme.textSecondary }]}>{n.body}</Text>
              <Text style={[styles.time, { color: theme.textSecondary }]}>
                {formatDayTime(n.at)}
                {staffName(n.createdBy) ? ` · by ${staffName(n.createdBy)}` : ''}
              </Text>
            </View>
            {n.at > readAtOnOpen && <View style={styles.unread} accessibilityLabel="Unread" />}
          </Pressable>
        ))}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.three,
    gap: Spacing.four,
    paddingBottom: Spacing.six,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  kind: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  body: {
    fontSize: 14,
  },
  time: {
    fontSize: 12,
    marginTop: 2,
  },
  unread: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Accent,
  },
});
