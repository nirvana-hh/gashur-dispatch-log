import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { matchesQuery, SearchBar } from '@/components/search-bar';
import { TripRow } from '@/components/trip-row';
import { EmptyText } from '@/components/ui';
import { Accent, Spacing } from '@/constants/theme';
import { useClients, useDrivers, useTrips, useTrucks } from '@/hooks/use-store';
import { useTheme } from '@/hooks/use-theme';
import { billingStatus, lastActivity, needsReview } from '@/lib/calc';
import type { Client, Trip } from '@/lib/store';

type Filter = { key: string; label: string; test: (trip: Trip, client: Client | undefined) => boolean };

const Filters: Filter[] = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'transit', label: 'In transit', test: (trip) => !trip.delivery },
  { key: 'review', label: 'Needs review', test: (trip) => needsReview(trip) },
  { key: 'unbilled', label: 'Unbilled', test: (trip, client) => billingStatus(trip, client) === 'unbilled' },
  { key: 'overdue', label: 'Overdue', test: (trip, client) => billingStatus(trip, client) === 'overdue' },
  { key: 'paid', label: 'Paid', test: (trip, client) => billingStatus(trip, client) === 'paid' },
];

export default function TripsScreen() {
  const theme = useTheme();
  const trips = useTrips();
  const clients = useClients();
  const trucks = useTrucks();
  const drivers = useDrivers();
  // The filter lives in the URL so the dashboard can link straight to e.g. overdue trips.
  const params = useLocalSearchParams<{ filter?: string }>();
  const filter = Filters.find((f) => f.key === params.filter) ?? Filters[0];
  const [query, setQuery] = useState('');

  const clientById = new Map(clients.map((c) => [c.id, c]));
  const searchFields = (trip: Trip) => [
      trip.ref,
      clientById.get(trip.clientId)?.name,
      trucks.find((t) => t.id === trip.truckId)?.plate,
      drivers.find((d) => d.id === trip.driverId)?.name,
      trip.origin,
      trip.destination,
      trip.product,
    trip.billing?.invoiceNo,
  ];

  const visible = trips
    .filter((trip) => filter.test(trip, clientById.get(trip.clientId)))
    .filter((trip) => matchesQuery(query, searchFields(trip)))
    .sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)));

  return (
    <FlatList
      data={visible}
      keyExtractor={(trip) => trip.id}
      renderItem={({ item }) => <TripRow trip={item} />}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: theme.backgroundGrouped }}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.header}>
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="Search ref, client, truck, driver…"
            background={theme.card}
          />
          <View style={styles.filters} accessibilityRole="radiogroup">
            {Filters.map((option) => {
              const selected = option === filter;
              const count = trips.filter((trip) => option.test(trip, clientById.get(trip.clientId))).length;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => router.setParams({ filter: option.key })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${option.label}, ${count} trips`}
                  style={({ pressed }) => [
                    styles.filter,
                    {
                      backgroundColor: selected ? Accent : theme.card,
                      borderColor: selected ? Accent : theme.cardBorder,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}>
                  <Text style={[styles.filterCount, { color: selected ? '#ffffff' : theme.text }]}>{count}</Text>
                  <Text style={[styles.filterLabel, { color: selected ? '#ffffffdd' : theme.textSecondary }]} numberOfLines={1}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <EmptyText>{query.trim() ? 'No trips match your search.' : 'No trips here.'}</EmptyText>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  header: {
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  filter: {
    // Three per row; the gaps take up the rest.
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterCount: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    paddingTop: Spacing.five,
  },
});
