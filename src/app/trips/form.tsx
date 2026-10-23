import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Chip } from '@/components/chip';
import { Button, Card, Detail, DetailGrid, Field, Input, NumberInput } from '@/components/ui';
import { Accent, Spacing } from '@/constants/theme';
import { useClients, useDrivers, useTrips, useTrucks } from '@/hooks/use-store';
import { useTheme } from '@/hooks/use-theme';
import {
  computeFigures,
  Currency,
  formatDate,
  formatLitres,
  formatMoney,
  formatPct,
  formatRate,
  hoursFromNowIso,
  invoiceDueDate,
  LossTolerance,
  nowLocalInput,
  parseLocalInput,
  toLocalInput,
  UrgencyColors,
} from '@/lib/calc';
import {
  Depots,
  dispatchTrip,
  ProductInfo,
  Products,
  recordDelivery,
  recordInvoice,
  setPaid,
  updateDispatch,
  type Product,
  type Trip,
} from '@/lib/store';

type Stage = 'dispatch' | 'delivery' | 'billing';

const Stages: { key: Stage; label: string }[] = [
  { key: 'dispatch', label: '1 · Dispatch' },
  { key: 'delivery', label: '2 · Delivery' },
  { key: 'billing', label: '3 · Billing' },
];

const TransitPresets = [6, 12, 24, 36, 48];

export default function TripFormScreen() {
  const params = useLocalSearchParams<{ id?: string; stage?: Stage }>();
  const trips = useTrips();
  const trip = trips.find((t) => t.id === params.id);
  // Remount when switching trips so field state starts from that trip.
  return <TripForm key={trip?.id ?? 'new'} trip={trip} initialStage={trip ? (params.stage ?? 'dispatch') : 'dispatch'} />;
}

function TripForm({ trip, initialStage }: { trip?: Trip; initialStage: Stage }) {
  const theme = useTheme();
  const trips = useTrips();
  const clients = useClients();
  const trucks = useTrucks();
  const drivers = useDrivers();
  const [stage, setStage] = useState<Stage>(initialStage);

  // Trucks and drivers already out on another undelivered trip can't be dispatched again.
  const otherActive = trips.filter((t) => !t.delivery && t.id !== trip?.id);
  const busyTrucks = new Set(otherActive.map((t) => t.truckId));
  const busyDrivers = new Set(otherActive.map((t) => t.driverId));

  // Dispatch
  const [clientId, setClientId] = useState(trip?.clientId ?? clients[0]?.id);
  const [truckId, setTruckId] = useState(trip?.truckId ?? trucks.find((t) => !busyTrucks.has(t.id))?.id);
  const [driverId, setDriverId] = useState(trip?.driverId ?? drivers.find((d) => !busyDrivers.has(d.id))?.id);
  const [product, setProduct] = useState<Product>(trip?.product ?? 'PMS');
  const [origin, setOrigin] = useState(trip?.origin ?? Depots[0]);
  const [destination, setDestination] = useState(trip?.destination ?? clients[0]?.address ?? '');
  const [litresLoaded, setLitresLoaded] = useState(String(trip?.litresLoaded ?? trucks.find((t) => t.id === truckId)?.capacityLitres ?? ''));
  const [rate, setRate] = useState(String(trip?.ratePerLitre ?? clients[0]?.ratePerLitre ?? ''));
  const [dispatchedAt, setDispatchedAt] = useState(trip ? toLocalInput(trip.dispatchedAt) : nowLocalInput());
  const [transitHours, setTransitHours] = useState(
    String(trip ? Math.round((Date.parse(trip.dueAt) - Date.parse(trip.dispatchedAt)) / 3_600_000) : 24),
  );

  // Delivery
  const [litresDelivered, setLitresDelivered] = useState(String(trip?.delivery?.litresDelivered ?? ''));
  const [arrivedAt, setArrivedAt] = useState(trip?.delivery ? toLocalInput(trip.delivery.arrivedAt) : nowLocalInput());
  const [fuel, setFuel] = useState(String(trip?.delivery?.costs.fuel ?? ''));
  const [allowance, setAllowance] = useState(String(trip?.delivery?.costs.allowance ?? ''));
  const [tolls, setTolls] = useState(String(trip?.delivery?.costs.tolls ?? ''));
  const [other, setOther] = useState(String(trip?.delivery?.costs.other ?? ''));
  const [podReceived, setPodReceived] = useState(trip?.delivery?.podReceived ?? false);

  // Billing
  const nextInvoiceNo = `INV-${Math.max(2400, ...trips.map((t) => Number(t.billing?.invoiceNo.replace(/\D/g, '')) || 0)) + 1}`;
  const [invoiceNo, setInvoiceNo] = useState(trip?.billing?.invoiceNo ?? nextInvoiceNo);
  const [invoicedAt, setInvoicedAt] = useState((trip?.billing ? toLocalInput(trip.billing.invoicedAt) : nowLocalInput()).slice(0, 10));
  const [paid, setPaidState] = useState(!!trip?.billing?.paidAt);

  const client = clients.find((c) => c.id === clientId);
  const truck = trucks.find((t) => t.id === truckId);
  const driver = drivers.find((d) => d.id === driverId);

  const dispatchedIso = parseLocalInput(dispatchedAt);
  const overCapacity = !!truck && Number(litresLoaded) > truck.capacityLitres;
  const dispatchInput =
    client && truck && driver && dispatchedIso && Number(litresLoaded) > 0 && !overCapacity && Number(rate) > 0 && Number(transitHours) > 0 && destination.trim()
      ? {
          clientId: client.id,
          truckId: truck.id,
          driverId: driver.id,
          product,
          origin,
          destination: destination.trim(),
          litresLoaded: Number(litresLoaded),
          ratePerLitre: Number(rate),
          dispatchedAt: dispatchedIso,
          dueAt: hoursFromNowIso(Number(transitHours), Date.parse(dispatchedIso)),
        }
      : undefined;

  const arrivedIso = parseLocalInput(arrivedAt);
  const delivery: Trip['delivery'] =
    litresDelivered !== '' && arrivedIso
      ? {
          litresDelivered: Number(litresDelivered),
          arrivedAt: arrivedIso,
          costs: { fuel: Number(fuel) || 0, allowance: Number(allowance) || 0, tolls: Number(tolls) || 0, other: Number(other) || 0 },
          podReceived,
        }
      : undefined;
  // Preview against the dispatch fields as currently edited, falling back to the saved trip.
  const preview = computeFigures(dispatchInput ?? trip ?? { litresLoaded: 0, ratePerLitre: 0, product, dueAt: '' }, delivery);
  const savedFigures = trip?.delivery ? computeFigures(trip, trip.delivery) : undefined;

  const invoicedIso = parseLocalInput(invoicedAt);
  const canSave =
    stage === 'dispatch' ? !!dispatchInput : stage === 'delivery' ? !!trip && !!delivery && !!preview : !!trip?.delivery && !!invoicedIso && !!invoiceNo.trim();

  function save() {
    if (stage === 'dispatch' && dispatchInput) {
      if (trip) updateDispatch(trip.id, dispatchInput);
      else dispatchTrip(dispatchInput);
    } else if (stage === 'delivery' && trip && delivery) {
      recordDelivery(trip.id, delivery);
    } else if (stage === 'billing' && trip && savedFigures && invoicedIso) {
      recordInvoice(trip.id, invoiceNo.trim(), invoicedIso, savedFigures.revenue);
      if (paid !== !!trip.billing?.paidAt) setPaid(trip.id, paid);
    } else {
      return;
    }
    router.back();
  }

  const stageEnabled = (key: Stage) => key === 'dispatch' || (!!trip && (key === 'delivery' || !!trip.delivery));

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets>
      <Stack.Screen options={{ title: trip ? trip.ref : 'New trip' }} />

      <View style={styles.stages}>
        {Stages.map(({ key, label }) => (
          <Chip key={key} label={label} selected={stage === key} disabled={!stageEnabled(key)} onPress={() => setStage(key)} compact />
        ))}
      </View>
      {!trip && (
        <Text style={[styles.note, { color: theme.textSecondary }]}>
          Delivery and billing open once the trip is dispatched.
        </Text>
      )}

      {stage === 'dispatch' && (
        <>
          <Field label="Client">
            {clients.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                selected={c.id === clientId}
                onPress={() => {
                  setClientId(c.id);
                  setRate(String(c.ratePerLitre));
                  if (!trip) setDestination(c.address);
                }}
              />
            ))}
          </Field>
          <Field label="Truck">
            {trucks.map((t) => (
              <Chip
                key={t.id}
                label={t.plate}
                detail={busyTrucks.has(t.id) ? 'On a trip' : formatLitres(t.capacityLitres)}
                selected={t.id === truckId}
                disabled={busyTrucks.has(t.id)}
                onPress={() => {
                  setTruckId(t.id);
                  if (!trip) setLitresLoaded(String(t.capacityLitres));
                }}
              />
            ))}
          </Field>
          <Field label="Driver">
            {drivers.map((d) => (
              <Chip
                key={d.id}
                label={d.name}
                detail={busyDrivers.has(d.id) ? 'On a trip' : undefined}
                selected={d.id === driverId}
                disabled={busyDrivers.has(d.id)}
                onPress={() => setDriverId(d.id)}
              />
            ))}
          </Field>
          <Field label="Product">
            {Products.map((p) => (
              <Chip key={p} label={ProductInfo[p].label} selected={p === product} onPress={() => setProduct(p)} />
            ))}
          </Field>
          <Field label="Load at">
            {Depots.map((d) => (
              <Chip key={d} label={d} selected={d === origin} onPress={() => setOrigin(d)} />
            ))}
          </Field>
          <Field label="Deliver to">
            <Input value={destination} onChangeText={setDestination} placeholder="e.g. Gulu" />
          </Field>
          <Field
            label="Litres loaded"
            hint={truck ? `${overCapacity ? 'Too much: ' : ''}${truck.plate} holds ${formatLitres(truck.capacityLitres)}` : undefined}>
            <NumberInput value={litresLoaded} onChangeText={setLitresLoaded} placeholder="33000" />
          </Field>
          <Field label={`Rate per litre (${Currency})`} hint={client ? `${client.name}'s agreed rate is ${formatRate(client.ratePerLitre)}` : undefined}>
            <NumberInput value={rate} onChangeText={setRate} decimal placeholder="0.06" />
          </Field>
          <Field label="Dispatched at" hint="YYYY-MM-DD HH:mm">
            <Input value={dispatchedAt} onChangeText={setDispatchedAt} autoCorrect={false} />
          </Field>
          <Field label="Expected transit (hours)" hint="Arriving later than this counts as late.">
            {TransitPresets.map((h) => (
              <Chip key={h} label={`${h}h`} selected={String(h) === transitHours} onPress={() => setTransitHours(String(h))} compact />
            ))}
            <NumberInput value={transitHours} onChangeText={setTransitHours} style={styles.smallInput} />
          </Field>
        </>
      )}

      {stage === 'delivery' && trip && (
        <>
          <Field
            label="Litres delivered"
            hint={
              Number(litresDelivered) > trip.litresLoaded
                ? `More than the ${formatLitres(trip.litresLoaded)} loaded. Check the figure.`
                : `Loaded ${formatLitres(trip.litresLoaded)}. Allowed loss ${formatPct(LossTolerance)}.`
            }>
            <NumberInput value={litresDelivered} onChangeText={setLitresDelivered} placeholder={String(trip.litresLoaded)} />
          </Field>
          <Field label="Arrived at" hint="YYYY-MM-DD HH:mm">
            <Input value={arrivedAt} onChangeText={setArrivedAt} autoCorrect={false} />
            <Chip label="Now" selected={false} onPress={() => setArrivedAt(nowLocalInput())} compact />
          </Field>
          <Field label={`Trip costs (${Currency})`}>
            <CostInput label="Truck fuel" value={fuel} onChange={setFuel} />
            <CostInput label="Driver allowance" value={allowance} onChange={setAllowance} />
            <CostInput label="Tolls & levies" value={tolls} onChange={setTolls} />
            <CostInput label="Other" value={other} onChange={setOther} />
          </Field>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: theme.text }]}>Proof of delivery received</Text>
            <Switch value={podReceived} onValueChange={setPodReceived} trackColor={{ true: Accent }} />
          </View>

          <Card>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Calculated</Text>
            {preview ? (
              <DetailGrid>
                <Detail
                  label="Loss"
                  value={`${formatLitres(preview.lossLitres)} (${formatPct(preview.lossPct, 2)})`}
                  color={preview.lossFlagged ? UrgencyColors.overdue : undefined}
                />
                <Detail label="Variance vs tolerance" value={preview.lossFlagged ? `${formatLitres(Math.round(preview.excessLitres))} over` : 'Within'} color={preview.lossFlagged ? UrgencyColors.overdue : UrgencyColors.ok} />
                <Detail label="Revenue" value={formatMoney(preview.revenue)} />
                <Detail label="Shortage charge" value={formatMoney(preview.shortageCharge)} />
                <Detail label="Costs" value={formatMoney(preview.costs)} />
                <Detail label="Margin" value={`${formatMoney(preview.margin)} (${formatPct(preview.marginPct)})`} color={preview.margin < 0 ? UrgencyColors.overdue : undefined} />
                <Detail label="On time" value={preview.onTime ? 'Yes' : 'Late'} color={preview.onTime ? UrgencyColors.ok : UrgencyColors.overdue} wide />
              </DetailGrid>
            ) : (
              <Text style={[styles.note, { color: theme.textSecondary }]}>Enter litres delivered and arrival time to see loss, revenue and margin.</Text>
            )}
          </Card>
        </>
      )}

      {stage === 'billing' && trip && savedFigures && (
        <>
          <Card>
            <DetailGrid>
              <Detail label="Invoice amount" value={formatMoney(savedFigures.revenue)} />
              <Detail label="Credit terms" value={`${client?.creditDays ?? 30} days`} />
              {invoicedIso && (
                <Detail label="Due" value={formatDate(invoiceDueDate({ ...trip, billing: { invoiceNo, invoicedAt: invoicedIso } }, client)!.toISOString())} wide />
              )}
            </DetailGrid>
          </Card>
          <Field label="Invoice number">
            <Input value={invoiceNo} onChangeText={setInvoiceNo} autoCapitalize="characters" autoCorrect={false} />
          </Field>
          <Field label="Invoice date" hint="YYYY-MM-DD">
            <Input value={invoicedAt} onChangeText={setInvoicedAt} autoCorrect={false} />
          </Field>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: theme.text }]}>Payment received</Text>
            <Switch value={paid} onValueChange={setPaidState} trackColor={{ true: Accent }} />
          </View>
        </>
      )}

      <Button
        label={stage === 'dispatch' ? (trip ? 'Save dispatch details' : 'Dispatch trip') : stage === 'delivery' ? 'Save delivery' : 'Save billing'}
        onPress={save}
        disabled={!canSave}
      />
    </ScrollView>
  );
}

function CostInput({ label, value, onChange }: { label: string; value: string; onChange: (text: string) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.cost}>
      <Text style={[styles.costLabel, { color: theme.textSecondary }]}>{label}</Text>
      <NumberInput value={value} onChangeText={onChange} decimal placeholder="0" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.three,
    gap: Spacing.four,
    paddingBottom: Spacing.six,
  },
  stages: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  note: {
    fontSize: 14,
    marginTop: -Spacing.two,
  },
  smallInput: {
    flex: 0,
    minWidth: 80,
    paddingVertical: 6,
  },
  cost: {
    flexBasis: '45%',
    flexGrow: 1,
    gap: Spacing.one,
  },
  costLabel: {
    fontSize: 13,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
});
