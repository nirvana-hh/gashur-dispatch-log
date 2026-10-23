import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { matchesQuery, SearchBar } from '@/components/search-bar';
import { EmptyText } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useClients, useTrips } from '@/hooks/use-store';
import { useTheme } from '@/hooks/use-theme';
import { billingStatus, figures, formatMoney, formatRate, UrgencyColors } from '@/lib/calc';

export default function ClientsScreen() {
  const theme = useTheme();
  const clients = useClients();
  const trips = useTrips();
  const [query, setQuery] = useState('');
  const visible = clients.filter((c) => matchesQuery(query, [c.name, c.contact, c.phone, c.email, c.address]));

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.container}>
      <SearchBar value={query} onChange={setQuery} placeholder="Search name, contact, city…" />
      {clients.length === 0 && <EmptyText>No clients yet. Tap + New to add one.</EmptyText>}
      {clients.length > 0 && visible.length === 0 && <EmptyText>No clients match your search.</EmptyText>}
      {visible.map((client) => {
        let outstanding = 0;
        let overdue = 0;
        for (const trip of trips.filter((t) => t.clientId === client.id)) {
          const status = billingStatus(trip, client);
          if (status === 'invoiced' || status === 'overdue') outstanding += figures(trip)!.revenue;
          if (status === 'overdue') overdue++;
        }
        return (
          <Pressable
            key={client.id}
            onPress={() => router.push({ pathname: '/edit/client', params: { id: client.id } })}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
            ]}>
            <Text style={[styles.title, { color: theme.text }]}>{client.name}</Text>
            <Text style={[styles.meta, { color: theme.textSecondary }]}>
              {client.contact} · {client.phone}
            </Text>
            <Text style={[styles.meta, { color: theme.textSecondary }]}>
              {formatRate(client.ratePerLitre)} · {client.creditDays}-day terms · {client.address}
            </Text>
            <View style={styles.footer}>
              <Text style={[styles.meta, { color: theme.textSecondary }]}>Outstanding</Text>
              <Text style={[styles.money, { color: overdue > 0 ? UrgencyColors.overdue : theme.text }]}>
                {formatMoney(outstanding)}
                {overdue > 0 ? ` · ${overdue} overdue` : ''}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.three,
    gap: Spacing.two,
    paddingBottom: Spacing.six,
  },
  row: {
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: Spacing.one,
  },
  meta: {
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  money: {
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
