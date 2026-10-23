import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AlertList } from '@/components/alert-list';
import { BarChart } from '@/components/bar-chart';
import { Chip } from '@/components/chip';
import { Icon } from '@/components/icon';
import { Card, EmptyText, Section } from '@/components/ui';
import { Accent, Spacing } from '@/constants/theme';
import { useClients, useDrivers, useTrips, useTrucks } from '@/hooks/use-store';
import { useTheme } from '@/hooks/use-theme';
import {
  driverAlerts,
  figures,
  formatLitres,
  formatMoney,
  formatMoneyShort,
  formatPct,
  formatToday,
  summarize,
  truckAlerts,
  UrgencyColors,
} from '@/lib/calc';

const Periods = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
];

export default function DashboardScreen() {
  const theme = useTheme();
  const trips = useTrips();
  const clients = useClients();
  const trucks = useTrucks();
  const drivers = useDrivers();
  const [period, setPeriod] = useState(Periods[1]);

  const summary = summarize(trips, clients, trucks, period.days);
  const lossTrips = trips.filter((trip) => figures(trip)?.lossFlagged && !trip.lossReviewed);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.container}>
      <View style={styles.topRow}>
        <Text style={[styles.date, { color: theme.textSecondary }]}>{formatToday()}</Text>
        <View style={styles.periods}>
          {Periods.map((option) => (
            <Chip
              key={option.label}
              label={option.label}
              selected={option === period}
              onPress={() => setPeriod(option)}
              compact
            />
          ))}
        </View>
      </View>

      <View style={styles.stats}>
        <StatCard
          label="Revenue"
          value={formatMoneyShort(summary.revenue)}
          detail={`${summary.deliveredCount} deliveries`}
        />
        <StatCard
          label="Gross margin"
          value={formatMoneyShort(summary.margin)}
          detail={`${formatPct(summary.marginPct)} of revenue`}
        />
        <StatCard
          label="Outstanding"
          value={formatMoneyShort(summary.outstanding)}
          detail={summary.overdueCount > 0 ? `${summary.overdueCount} overdue` : 'None overdue'}
          detailColor={summary.overdueCount > 0 ? UrgencyColors.overdue : undefined}
          href={{ pathname: '/trips', params: { filter: 'overdue' } }}
        />
        <StatCard
          label="On-time rate"
          value={summary.onTimeRate === undefined ? '—' : formatPct(summary.onTimeRate, 0)}
          detail={`${summary.inTransitCount} on the road`}
        />
        <StatCard
          label="Trips needing review"
          value={String(summary.reviewCount)}
          detail={summary.reviewCount > 0 ? 'Loss or missing POD' : 'All clear'}
          highlight={summary.reviewCount > 0}
          href={{ pathname: '/trips', params: { filter: 'review' } }}
          wide
        />
      </View>

      <Section title="Revenue by client">
        <Card>
          {summary.revenueByClient.length > 0 ? (
            <BarChart
              rows={summary.revenueByClient}
              color={Accent}
              negativeColor={UrgencyColors.overdue}
              format={formatMoney}
            />
          ) : (
            <EmptyText>No deliveries in the last {period.label}.</EmptyText>
          )}
        </Card>
      </Section>

      <Section title="Margin by truck">
        <Card>
          {summary.marginByTruck.length > 0 ? (
            <BarChart
              rows={summary.marginByTruck}
              color="#0EA5E9"
              negativeColor={UrgencyColors.overdue}
              format={formatMoney}
            />
          ) : (
            <EmptyText>No deliveries in the last {period.label}.</EmptyText>
          )}
        </Card>
      </Section>

      <Section title="Alerts">
        <Card>
          <Text style={[styles.panelTitle, { color: theme.text }]}>Fuel loss</Text>
          {lossTrips.length > 0 ? (
            lossTrips.map((trip) => {
              const f = figures(trip)!;
              return (
                <Pressable
                  key={trip.id}
                  onPress={() => router.push({ pathname: '/trips/[id]', params: { id: trip.id } })}
                  style={({ pressed }) => [styles.alertRow, { opacity: pressed ? 0.6 : 1 }]}>
                  <Icon name="warning" size={18} color={UrgencyColors.overdue} />
                  <View style={styles.alertText}>
                    <Text style={[styles.alertSubject, { color: theme.text }]}>
                      {trip.ref} · {trip.destination}
                    </Text>
                    <Text style={[styles.alertDetail, { color: UrgencyColors.overdue }]}>
                      {formatLitres(f.lossLitres)} short ({formatPct(f.lossPct, 2)}) · {formatMoney(f.shortageCharge)}{' '}
                      charge
                    </Text>
                  </View>
                  <Icon name="chevron" size={14} color={theme.textSecondary} />
                </Pressable>
              );
            })
          ) : (
            <AlertList alerts={[]} empty="No losses above tolerance." />
          )}
        </Card>
        <Card>
          <Text style={[styles.panelTitle, { color: theme.text }]}>Driver licenses</Text>
          <AlertList alerts={driverAlerts(drivers)} empty="All licenses valid for 30+ days." />
        </Card>
        <Card>
          <Text style={[styles.panelTitle, { color: theme.text }]}>Truck service & insurance</Text>
          <AlertList alerts={truckAlerts(trucks)} empty="No service, insurance or inspection due." />
        </Card>
      </Section>
    </ScrollView>
  );
}

function StatCard({
  label,
  value,
  detail,
  detailColor,
  highlight,
  wide,
  href,
}: {
  label: string;
  value: string;
  detail: string;
  detailColor?: string;
  highlight?: boolean;
  wide?: boolean;
  href?: Href;
}) {
  const theme = useTheme();
  return (
    <Pressable
      disabled={!href}
      onPress={() => href && router.push(href)}
      style={({ pressed }) => [
        styles.stat,
        wide && styles.statWide,
        { backgroundColor: highlight ? Accent : theme.backgroundElement, opacity: pressed ? 0.8 : 1 },
      ]}>
      <Text style={[styles.statLabel, { color: highlight ? '#ffffffcc' : theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color: highlight ? '#ffffff' : theme.text }]}>{value}</Text>
      <Text style={[styles.statDetail, { color: highlight ? '#ffffffcc' : (detailColor ?? theme.textSecondary) }]}>
        {detail}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.three,
    gap: Spacing.four,
    paddingBottom: Spacing.six,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: -Spacing.two,
  },
  date: {
    fontSize: 15,
    fontWeight: '500',
  },
  periods: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  stat: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: 14,
    padding: Spacing.three,
    gap: 2,
  },
  statWide: {
    flexBasis: '100%',
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 26,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statDetail: {
    fontSize: 12,
    fontWeight: '500',
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  alertText: {
    flex: 1,
    gap: 2,
  },
  alertSubject: {
    fontSize: 15,
    fontWeight: '600',
  },
  alertDetail: {
    fontSize: 13,
  },
});
