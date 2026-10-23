import type { Client, Driver, Trip, TripCosts, Truck } from '@/lib/store';
import { ProductInfo } from '@/lib/store';

/** Transit loss allowed before a trip is flagged, as a share of litres loaded. */
export const LossTolerance = 0.005;

/** How far ahead compliance dates and service intervals start raising reminders. */
const ReminderDays = 30;
const ServiceReminderKm = 1_000;

const DayMs = 24 * 3_600_000;

// Trip figures

export type TripFigures = {
  lossLitres: number;
  lossPct: number;
  /** Litres lost beyond tolerance, charged back to the haulier at product price. */
  excessLitres: number;
  shortageCharge: number;
  grossRevenue: number;
  /** What the client is invoiced: gross revenue less the shortage charge. */
  revenue: number;
  costs: number;
  margin: number;
  marginPct: number;
  onTime: boolean;
  lossFlagged: boolean;
};

export function totalCosts(costs: TripCosts) {
  return costs.fuel + costs.allowance + costs.tolls + costs.other;
}

/**
 * The calculated delivery figures for a trip, or undefined until delivery is recorded.
 * Takes the inputs loosely so the trip form can preview figures before saving.
 */
export function computeFigures(
  trip: Pick<Trip, 'litresLoaded' | 'ratePerLitre' | 'product' | 'dueAt'>,
  delivery: Trip['delivery'],
): TripFigures | undefined {
  if (!delivery) return undefined;
  const lossLitres = trip.litresLoaded - delivery.litresDelivered;
  const lossPct = trip.litresLoaded > 0 ? lossLitres / trip.litresLoaded : 0;
  const excessLitres = Math.max(0, lossLitres - trip.litresLoaded * LossTolerance);
  const shortageCharge = excessLitres * ProductInfo[trip.product].pricePerLitre;
  const grossRevenue = delivery.litresDelivered * trip.ratePerLitre;
  const revenue = grossRevenue - shortageCharge;
  const costs = totalCosts(delivery.costs);
  const margin = revenue - costs;
  return {
    lossLitres,
    lossPct,
    excessLitres,
    shortageCharge,
    grossRevenue,
    revenue,
    costs,
    margin,
    marginPct: revenue > 0 ? margin / revenue : 0,
    onTime: delivery.arrivedAt <= trip.dueAt,
    lossFlagged: excessLitres > 0,
  };
}

export function figures(trip: Trip) {
  return computeFigures(trip, trip.delivery);
}

// Stages and billing

export type TripStage = 'in_transit' | 'delivered' | 'invoiced' | 'paid';

export const StageInfo: Record<TripStage, { label: string; color: string }> = {
  in_transit: { label: 'In transit', color: '#3B82F6' },
  delivered: { label: 'Delivered', color: '#0EA5E9' },
  invoiced: { label: 'Invoiced', color: '#F59E0B' },
  paid: { label: 'Paid', color: '#22C55E' },
};

export function stageOf(trip: Trip): TripStage {
  if (trip.billing?.paidAt) return 'paid';
  if (trip.billing) return 'invoiced';
  if (trip.delivery) return 'delivered';
  return 'in_transit';
}

export type BillingStatus = 'not_due' | 'unbilled' | 'invoiced' | 'overdue' | 'paid';

export const BillingInfo: Record<BillingStatus, { label: string; color: string }> = {
  not_due: { label: 'Not delivered', color: '#64748B' },
  unbilled: { label: 'Unbilled', color: '#64748B' },
  invoiced: { label: 'Invoiced', color: '#F59E0B' },
  overdue: { label: 'Overdue', color: '#EF4444' },
  paid: { label: 'Paid', color: '#22C55E' },
};

/** When an invoice becomes overdue under the client's credit terms. */
export function invoiceDueDate(trip: Trip, client: Client | undefined): Date | undefined {
  if (!trip.billing) return undefined;
  return new Date(new Date(trip.billing.invoicedAt).getTime() + (client?.creditDays ?? 30) * DayMs);
}

export function billingStatus(trip: Trip, client: Client | undefined): BillingStatus {
  if (!trip.delivery) return 'not_due';
  if (!trip.billing) return 'unbilled';
  if (trip.billing.paidAt) return 'paid';
  return invoiceDueDate(trip, client)!.getTime() < Date.now() ? 'overdue' : 'invoiced';
}

/** Why a trip needs a manager's attention, if it does. */
export function reviewReasons(trip: Trip): string[] {
  const reasons: string[] = [];
  const f = figures(trip);
  if (f?.lossFlagged && !trip.lossReviewed) reasons.push('Loss above tolerance');
  if (trip.delivery && !trip.delivery.podReceived) reasons.push('POD missing');
  return reasons;
}

export function needsReview(trip: Trip) {
  return reviewReasons(trip).length > 0;
}

// Dashboard

export function isWithinDays(iso: string, days: number) {
  return Date.now() - new Date(iso).getTime() < days * DayMs;
}

export type Summary = {
  revenue: number;
  margin: number;
  marginPct: number;
  outstanding: number;
  overdueCount: number;
  onTimeRate: number | undefined;
  deliveredCount: number;
  reviewCount: number;
  inTransitCount: number;
  revenueByClient: { id: string; label: string; value: number }[];
  marginByTruck: { id: string; label: string; value: number }[];
};

/** Headline numbers over trips delivered in the last `days` days; outstanding and review counts cover all trips. */
export function summarize(trips: Trip[], clients: Client[], trucks: Truck[], days: number): Summary {
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const recent = trips.filter((t) => t.delivery && isWithinDays(t.delivery.arrivedAt, days));
  const recentFigures = recent.map((t) => ({ trip: t, f: figures(t)! }));

  const revenue = sum(recentFigures.map(({ f }) => f.revenue));
  const margin = sum(recentFigures.map(({ f }) => f.margin));

  let outstanding = 0;
  let overdueCount = 0;
  for (const trip of trips) {
    const status = billingStatus(trip, clientById.get(trip.clientId));
    if (status === 'invoiced' || status === 'overdue') outstanding += figures(trip)!.revenue;
    if (status === 'overdue') overdueCount++;
  }

  const group = <T extends { id: string }>(items: T[], key: (trip: Trip) => string, label: (item: T) => string, value: (f: TripFigures) => number) =>
    items
      .map((item) => ({
        id: item.id,
        label: label(item),
        value: sum(recentFigures.filter(({ trip }) => key(trip) === item.id).map(({ f }) => value(f))),
      }))
      .filter((row) => row.value !== 0)
      .sort((a, b) => b.value - a.value);

  return {
    revenue,
    margin,
    marginPct: revenue > 0 ? margin / revenue : 0,
    outstanding,
    overdueCount,
    onTimeRate: recent.length > 0 ? recentFigures.filter(({ f }) => f.onTime).length / recent.length : undefined,
    deliveredCount: recent.length,
    reviewCount: trips.filter(needsReview).length,
    inTransitCount: trips.filter((t) => !t.delivery).length,
    revenueByClient: group(clients, (t) => t.clientId, (c) => c.name, (f) => f.revenue),
    marginByTruck: group(trucks, (t) => t.truckId, (t) => t.plate, (f) => f.margin),
  };
}

function sum(values: number[]) {
  return values.reduce((total, v) => total + v, 0);
}

// Compliance

export type Urgency = 'ok' | 'soon' | 'overdue';

export const UrgencyColors: Record<Urgency, string> = {
  ok: '#22C55E',
  soon: '#F59E0B',
  overdue: '#EF4444',
};

export function daysUntil(isoDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${isoDate}T00:00:00`).getTime() - today.getTime()) / DayMs);
}

export function dateUrgency(isoDate: string): Urgency {
  const days = daysUntil(isoDate);
  if (days < 0) return 'overdue';
  return days <= ReminderDays ? 'soon' : 'ok';
}

export function serviceUrgency(truck: Truck): Urgency {
  const remaining = truck.nextServiceKm - truck.odometerKm;
  if (remaining <= 0) return 'overdue';
  return remaining <= ServiceReminderKm ? 'soon' : 'ok';
}

export type ComplianceAlert = {
  key: string;
  kind: 'license' | 'service' | 'insurance' | 'inspection';
  subject: string;
  detail: string;
  urgency: Exclude<Urgency, 'ok'>;
  href: { pathname: '/edit/truck' | '/edit/driver'; params: { id: string } };
};

export function driverAlerts(drivers: Driver[]): ComplianceAlert[] {
  return drivers.flatMap((driver) => {
    const urgency = dateUrgency(driver.licenseExpiry);
    if (urgency === 'ok') return [];
    return [
      {
        key: `license-${driver.id}`,
        kind: 'license' as const,
        subject: driver.name,
        detail: `License ${describeDue(driver.licenseExpiry)}`,
        urgency,
        href: { pathname: '/edit/driver' as const, params: { id: driver.id } },
      },
    ];
  });
}

export function truckAlerts(trucks: Truck[]): ComplianceAlert[] {
  return trucks.flatMap((truck) => {
    const href = { pathname: '/edit/truck' as const, params: { id: truck.id } };
    const alerts: ComplianceAlert[] = [];
    const service = serviceUrgency(truck);
    if (service !== 'ok') {
      const remaining = truck.nextServiceKm - truck.odometerKm;
      alerts.push({
        key: `service-${truck.id}`,
        kind: 'service',
        subject: truck.plate,
        detail: remaining > 0 ? `Service due in ${remaining.toLocaleString()} km` : `Service overdue by ${(-remaining).toLocaleString()} km`,
        urgency: service,
        href,
      });
    }
    for (const [kind, isoDate] of [
      ['insurance', truck.insuranceExpiry],
      ['inspection', truck.inspectionExpiry],
    ] as const) {
      const urgency = dateUrgency(isoDate);
      if (urgency !== 'ok') {
        alerts.push({
          key: `${kind}-${truck.id}`,
          kind,
          subject: truck.plate,
          detail: `${kind === 'insurance' ? 'Insurance' : 'Inspection'} ${describeDue(isoDate)}`,
          urgency,
          href,
        });
      }
    }
    return alerts;
  });
}

function describeDue(isoDate: string) {
  const days = daysUntil(isoDate);
  if (days < 0) return `expired ${-days} day${days === -1 ? '' : 's'} ago`;
  if (days === 0) return 'expires today';
  return `expires in ${days} day${days === 1 ? '' : 's'}`;
}

// Formatting

export const Currency = '$';

export function formatMoney(amount: number) {
  const sign = amount < 0 ? '−' : '';
  return `${sign}${Currency}${Math.round(Math.abs(amount)).toLocaleString()}`;
}

/** Compact money for tight spaces, e.g. $1.2M. */
export function formatMoneyShort(amount: number) {
  const sign = amount < 0 ? '−' : '';
  const abs = Math.abs(amount);
  if (abs >= 999_500) return `${sign}${Currency}${(abs / 1_000_000).toFixed(abs >= 9_995_000 ? 1 : 2)}M`;
  if (abs >= 999.5) return `${sign}${Currency}${(abs / 1_000).toFixed(abs >= 99_950 ? 0 : 1)}k`;
  return formatMoney(amount);
}

/** A per-litre rate, e.g. $0.065/L. */
export function formatRate(rate: number) {
  return `${Currency}${rate}/L`;
}

export function formatLitres(litres: number) {
  return `${litres.toLocaleString()} L`;
}

export function formatPct(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDayTime(iso: string) {
  const date = new Date(iso);
  if (date.toDateString() === new Date().toDateString()) return `Today, ${formatTime(iso)}`;
  return `${date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}, ${formatTime(iso)}`;
}

export function formatDate(isoDate: string) {
  return new Date(isoDate.length === 10 ? `${isoDate}T00:00:00` : isoDate).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** A day without the year, e.g. "Wed, Oct 22" (Today for today). */
export function formatShortDate(iso: string) {
  const date = new Date(iso);
  if (date.toDateString() === new Date().toDateString()) return 'Today';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatToday() {
  return new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

/** The latest time anything happened on the trip; lists sort by this. */
export function lastActivity(trip: Trip) {
  return trip.billing?.paidAt ?? trip.billing?.invoicedAt ?? trip.delivery?.arrivedAt ?? trip.dispatchedAt;
}

export function nowIso() {
  return new Date().toISOString();
}

export function hoursFromNowIso(hours: number, from = Date.now()) {
  return new Date(from + hours * 3_600_000).toISOString();
}

// Date entry. Forms take times as "YYYY-MM-DD HH:mm" text in local time.

const pad = (n: number) => String(n).padStart(2, '0');

export function toLocalInput(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function nowLocalInput() {
  return toLocalInput(nowIso());
}

/** Parses "YYYY-MM-DD HH:mm" (or just the date) as local time; undefined if malformed. */
export function parseLocalInput(text: string): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(text.trim());
  if (!match) return undefined;
  const [y, m, d, h, min] = match.slice(1).map((part) => Number(part ?? 0));
  if (h > 23 || min > 59) return undefined;
  const date = new Date(y, m - 1, d, h, min);
  // Reject dates that rolled over, e.g. Feb 30 → Mar 2.
  if (date.getMonth() !== m - 1 || date.getDate() !== d) return undefined;
  return date.toISOString();
}

/** Today plus `days`, as YYYY-MM-DD in local time. */
export function localDate(days = 0) {
  return toLocalInput(new Date(Date.now() + days * DayMs).toISOString()).slice(0, 10);
}

export function isValidDate(text: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(text) && parseLocalInput(text) !== undefined;
}
