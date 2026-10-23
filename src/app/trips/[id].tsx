import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { AuditLine, Badge, Button, Card, Detail, DetailGrid } from '@/components/ui';
import { Accent, Spacing } from '@/constants/theme';
import { useCanManage, useStaffName } from '@/hooks/use-session';
import { useClients, useDrivers, useTrips, useTrucks } from '@/hooks/use-store';
import { useTheme } from '@/hooks/use-theme';
import {
  BillingInfo,
  billingStatus,
  figures,
  formatDate,
  formatDayTime,
  formatLitres,
  formatMoney,
  formatPct,
  formatRate,
  invoiceDueDate,
  reviewReasons,
  StageInfo,
  stageOf,
  UrgencyColors,
} from '@/lib/calc';
import { confirmAction } from '@/lib/confirm';
import { deleteTrip, markLossReviewed, ProductInfo, setPaid } from '@/lib/store';

export default function TripScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrips().find((t) => t.id === id);
  const clients = useClients();
  const trucks = useTrucks();
  const drivers = useDrivers();
  const canManage = useCanManage();
  const staffName = useStaffName();

  if (!trip) {
    return (
      <View style={[styles.missing, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.textSecondary, fontSize: 16 }}>This trip no longer exists.</Text>
      </View>
    );
  }

  const client = clients.find((c) => c.id === trip.clientId);
  const truck = trucks.find((t) => t.id === trip.truckId);
  const driver = drivers.find((d) => d.id === trip.driverId);
  const stage = StageInfo[stageOf(trip)];
  const billing = billingStatus(trip, client);
  const f = figures(trip);
  const reasons = reviewReasons(trip);

  function confirmDelete() {
    confirmAction('Delete this trip?', `${trip!.ref} and its notifications will be removed.`, 'Delete', () => {
      router.back();
      deleteTrip(trip!.id);
    });
  }

  const next = !trip.delivery
    ? { stage: 'delivery' as const, label: 'Record delivery' }
    : !trip.billing
      ? { stage: 'billing' as const, label: 'Record invoice' }
      : undefined;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: trip.ref }} />

      {reasons.length > 0 && (
        <View style={[styles.review, { backgroundColor: `${UrgencyColors.overdue}18` }]}>
          <Icon name="warning" size={18} color={UrgencyColors.overdue} />
          <Text style={[styles.reviewText, { color: UrgencyColors.overdue }]}>Needs review: {reasons.join(', ')}</Text>
        </View>
      )}

      <Card>
        <View style={styles.badges}>
          <Badge label={stage.label} color={stage.color} />
          {billing !== 'not_due' && <Badge label={BillingInfo[billing].label} color={BillingInfo[billing].color} />}
        </View>
        <Text style={[styles.client, { color: theme.text }]}>{client?.name ?? 'Unknown client'}</Text>
        <Text style={[styles.route, { color: theme.textSecondary }]}>
          {trip.origin} → {trip.destination}
        </Text>
      </Card>

      <StageCard title="Dispatch" stage="dispatch" tripId={trip.id}>
        <DetailGrid>
          <Detail label="Truck" value={truck?.plate ?? '—'} />
          <Detail label="Driver" value={driver?.name ?? '—'} />
          <Detail label="Product" value={ProductInfo[trip.product].label} />
          <Detail label="Loaded" value={formatLitres(trip.litresLoaded)} />
          <Detail label="Rate" value={formatRate(trip.ratePerLitre)} />
          <Detail label="Dispatched" value={formatDayTime(trip.dispatchedAt)} />
          <Detail label="Due" value={formatDayTime(trip.dueAt)} wide />
        </DetailGrid>
      </StageCard>

      {trip.delivery && f && (
        <StageCard title="Delivery" stage="delivery" tripId={trip.id}>
          <DetailGrid>
            <Detail label="Delivered" value={formatLitres(trip.delivery.litresDelivered)} />
            <Detail label="Arrived" value={formatDayTime(trip.delivery.arrivedAt)} />
            <Detail
              label="Loss"
              value={`${formatLitres(f.lossLitres)} (${formatPct(f.lossPct, 2)})`}
              color={f.lossFlagged ? UrgencyColors.overdue : undefined}
            />
            <Detail label="On time" value={f.onTime ? 'Yes' : 'Late'} color={f.onTime ? UrgencyColors.ok : UrgencyColors.overdue} />
            <Detail label="Revenue" value={formatMoney(f.revenue)} />
            <Detail label="Shortage charge" value={formatMoney(f.shortageCharge)} />
            <Detail label="Costs" value={formatMoney(f.costs)} />
            <Detail label="Margin" value={`${formatMoney(f.margin)} (${formatPct(f.marginPct)})`} color={f.margin < 0 ? UrgencyColors.overdue : undefined} />
            <Detail label="POD" value={trip.delivery.podReceived ? 'Received' : 'Missing'} color={trip.delivery.podReceived ? undefined : UrgencyColors.overdue} wide />
          </DetailGrid>
          {f.lossFlagged && !trip.lossReviewed && canManage && (
            <Button label="Mark loss as reviewed" variant="secondary" onPress={() => markLossReviewed(trip.id)} />
          )}
        </StageCard>
      )}

      {trip.billing && (
        <StageCard title="Billing" stage="billing" tripId={trip.id}>
          <DetailGrid>
            <Detail label="Invoice" value={trip.billing.invoiceNo} />
            <Detail label="Invoiced" value={formatDate(trip.billing.invoicedAt)} />
            <Detail
              label={trip.billing.paidAt ? 'Paid' : 'Payment due'}
              value={formatDate(trip.billing.paidAt ?? invoiceDueDate(trip, client)!.toISOString())}
              color={billing === 'overdue' ? UrgencyColors.overdue : undefined}
            />
            <Detail label="Terms" value={`${client?.creditDays ?? 30} days`} />
          </DetailGrid>
          <Button
            label={trip.billing.paidAt ? 'Mark as unpaid' : 'Mark as paid'}
            variant="secondary"
            onPress={() => setPaid(trip.id, !trip.billing!.paidAt)}
          />
        </StageCard>
      )}

      {next && (
        <Button label={next.label} onPress={() => router.push({ pathname: '/trips/form', params: { id: trip.id, stage: next.stage } })} />
      )}
      {canManage && <Button label="Delete trip" variant="destructive" onPress={confirmDelete} />}
      <AuditLine createdBy={staffName(trip.createdBy)} updatedBy={staffName(trip.updatedBy)} />
    </ScrollView>
  );
}

function StageCard({ title, stage, tripId, children }: { title: string; stage: 'dispatch' | 'delivery' | 'billing'; tripId: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Card>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
        <Link href={{ pathname: '/trips/form', params: { id: tripId, stage } }} asChild>
          <Pressable hitSlop={8}>
            <Text style={styles.edit}>Edit</Text>
          </Pressable>
        </Link>
      </View>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  review: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 12,
    padding: Spacing.three,
  },
  reviewText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  badges: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  client: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: -Spacing.two,
  },
  route: {
    fontSize: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  edit: {
    color: Accent,
    fontSize: 15,
    fontWeight: '600',
  },
});
