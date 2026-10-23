import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, EmptyText, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useStaff } from '@/hooks/use-store';
import { useTheme } from '@/hooks/use-theme';
import type { Staff } from '@/lib/store';

/** Managers only (linked from the Account screen); the edge function enforces it too. */
export default function StaffScreen() {
  const theme = useTheme();
  const session = useSession();
  const staff = [...useStaff()].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  const me = session.status === 'signedIn' ? session.userId : undefined;

  const groups: { title: string; people: Staff[] }[] = [
    { title: 'Managers', people: staff.filter((s) => s.active && s.role === 'manager') },
    { title: 'Dispatchers', people: staff.filter((s) => s.active && s.role === 'dispatcher') },
    { title: 'Removed', people: staff.filter((s) => !s.active) },
  ];

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.container}>
      <Button label="Add person" onPress={() => router.push('/edit/staff')} />
      {staff.length === 0 && <EmptyText>No staff synced yet.</EmptyText>}
      {groups
        .filter((g) => g.people.length > 0)
        .map((group) => (
          <Section key={group.title} title={group.title}>
            {group.people.map((person) => (
              <Pressable
                key={person.id}
                onPress={() => router.push({ pathname: '/edit/staff', params: { id: person.id } })}
                style={({ pressed }) => [styles.row, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 }]}>
                <View style={styles.text}>
                  <Text style={[styles.name, { color: person.active ? theme.text : theme.textSecondary }]}>
                    {person.name || person.email}
                    {person.id === me ? ' (you)' : ''}
                  </Text>
                  <Text style={[styles.email, { color: theme.textSecondary }]}>{person.email}</Text>
                </View>
                {person.active ? (
                  <Badge label={person.role === 'manager' ? 'Manager' : 'Dispatcher'} color={person.role === 'manager' ? '#8B5CF6' : '#3B82F6'} />
                ) : (
                  <Badge label="No access" color="#64748B" />
                )}
              </Pressable>
            ))}
          </Section>
        ))}
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
    gap: Spacing.two,
    borderRadius: 14,
    padding: Spacing.three,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  email: {
    fontSize: 13,
  },
});
