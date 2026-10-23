import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { UrgencyColors, type ComplianceAlert } from '@/lib/calc';

/** Compliance reminders, each opening the truck or driver it concerns. */
export function AlertList({ alerts, empty }: { alerts: ComplianceAlert[]; empty: string }) {
  const theme = useTheme();
  if (alerts.length === 0) {
    return (
      <View style={styles.row}>
        <Icon name="check" size={18} color={UrgencyColors.ok} />
        <Text style={[styles.detail, { color: theme.textSecondary }]}>{empty}</Text>
      </View>
    );
  }
  return (
    <View style={styles.list}>
      {alerts.map((alert) => (
        <Pressable
          key={alert.key}
          onPress={() => router.push(alert.href)}
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
          <Icon name="warning" size={18} color={UrgencyColors[alert.urgency]} />
          <View style={styles.text}>
            <Text style={[styles.subject, { color: theme.text }]}>{alert.subject}</Text>
            <Text
              style={[
                styles.detail,
                { color: alert.urgency === 'overdue' ? UrgencyColors.overdue : theme.textSecondary },
              ]}>
              {alert.detail}
            </Text>
          </View>
          <Icon name="chevron" size={14} color={theme.textSecondary} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  subject: {
    fontSize: 15,
    fontWeight: '600',
  },
  detail: {
    fontSize: 13,
  },
});
