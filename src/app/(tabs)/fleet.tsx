import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Chip } from '@/components/chip';
import { matchesQuery, SearchBar } from '@/components/search-bar';
import { Badge, Button, EmptyText } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useDrivers, useTrips, useTrucks } from '@/hooks/use-store';
import { useTheme } from '@/hooks/use-theme';
import { dateUrgency, formatDate, formatLitres, serviceUrgency, UrgencyColors, type Urgency } from '@/lib/calc';

type Tab = 'trucks' | 'drivers';

export default function FleetScreen() {
  const theme = useTheme();
  const trucks = useTrucks();
  const drivers = useDrivers();
  const onTrip = useTrips().filter((t) => !t.delivery);
  const [tab, setTab] = useState<Tab>('trucks');
  const [query, setQuery] = useState('');
  const visibleTrucks = trucks.filter((t) => matchesQuery(query, [t.plate, t.capacityLitres, t.odometerKm]));
  const visibleDrivers = drivers.filter((d) => matchesQuery(query, [d.name, d.phone, d.licenseNo]));

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.container}>
      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder={tab === 'trucks' ? 'Search plate number…' : 'Search name, phone, license…'}
      />
      <View style={styles.tabs}>
        <Chip
          label={`Trucks (${trucks.length})`}
          selected={tab === 'trucks'}
          onPress={() => setTab('trucks')}
          compact
        />
        <Chip
          label={`Drivers (${drivers.length})`}
          selected={tab === 'drivers'}
          onPress={() => setTab('drivers')}
          compact
        />
      </View>

      {tab === 'trucks' ? (
        <>
          {visibleTrucks.length === 0 && <EmptyText>{query.trim() ? 'No trucks match your search.' : 'No trucks yet.'}</EmptyText>}
          {visibleTrucks.map((truck) => (
            <Pressable
              key={truck.id}
              onPress={() => router.push({ pathname: '/edit/truck', params: { id: truck.id } })}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
              ]}>
              <View style={styles.header}>
                <Text style={[styles.title, { color: theme.text }]}>{truck.plate}</Text>
                {onTrip.some((t) => t.truckId === truck.id) ? (
                  <Badge label="On a trip" color="#3B82F6" />
                ) : (
                  <Badge label="Available" color="#22C55E" />
                )}
              </View>
              <Text style={[styles.meta, { color: theme.textSecondary }]}>
                {formatLitres(truck.capacityLitres)} · {truck.odometerKm.toLocaleString()} km
              </Text>
              <View style={styles.checks}>
                <Check
                  label="Service"
                  value={`at ${truck.nextServiceKm.toLocaleString()} km`}
                  urgency={serviceUrgency(truck)}
                />
                <Check
                  label="Insurance"
                  value={formatDate(truck.insuranceExpiry)}
                  urgency={dateUrgency(truck.insuranceExpiry)}
                />
                <Check
                  label="Inspection"
                  value={formatDate(truck.inspectionExpiry)}
                  urgency={dateUrgency(truck.inspectionExpiry)}
                />
              </View>
            </Pressable>
          ))}
          <Button label="Add truck" variant="secondary" onPress={() => router.push('/edit/truck')} />
        </>
      ) : (
        <>
          {visibleDrivers.length === 0 && <EmptyText>{query.trim() ? 'No drivers match your search.' : 'No drivers yet.'}</EmptyText>}
          {visibleDrivers.map((driver) => (
            <Pressable
              key={driver.id}
              onPress={() => router.push({ pathname: '/edit/driver', params: { id: driver.id } })}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
              ]}>
              <View style={styles.header}>
                <Text style={[styles.title, { color: theme.text }]}>{driver.name}</Text>
                {onTrip.some((t) => t.driverId === driver.id) ? (
                  <Badge label="On a trip" color="#3B82F6" />
                ) : (
                  <Badge label="Available" color="#22C55E" />
                )}
              </View>
              <Text style={[styles.meta, { color: theme.textSecondary }]}>
                {driver.phone} · License {driver.licenseNo}
              </Text>
              <View style={styles.checks}>
                <Check
                  label="License"
                  value={formatDate(driver.licenseExpiry)}
                  urgency={dateUrgency(driver.licenseExpiry)}
                />
              </View>
            </Pressable>
          ))}
          <Button label="Add driver" variant="secondary" onPress={() => router.push('/edit/driver')} />
        </>
      )}
    </ScrollView>
  );
}

function Check({ label, value, urgency }: { label: string; value: string; urgency: Urgency }) {
  const theme = useTheme();
  return (
    <View style={styles.check}>
      <View style={[styles.dot, { backgroundColor: UrgencyColors[urgency] }]} />
      <Text style={[styles.meta, { color: urgency === 'ok' ? theme.textSecondary : UrgencyColors[urgency] }]}>
        {label}{urgency === 'overdue' ? ' overdue' : urgency === 'soon' ? ' due soon' : ''} · {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.three,
    gap: Spacing.two,
    paddingBottom: Spacing.six,
  },
  tabs: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  row: {
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  meta: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  checks: {
    gap: Spacing.one,
  },
  check: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
