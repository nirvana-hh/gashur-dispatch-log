import type { AppNotification, Client, Driver, Staff, Trip, Truck } from '@/lib/store';

/**
 * Conversions between app objects (camelCase, nested trip stages) and Supabase rows
 * (snake_case, flat columns). Kept separate so the store and the sync engine share them.
 */

export type Table = 'clients' | 'trucks' | 'drivers' | 'trips' | 'notifications' | 'profiles';

export type Row = Record<string, unknown>;

// Postgres returns timestamps as "2026-10-22T10:00:00+00:00"; the app compares ISO strings
// with "Z" directly (e.g. arrival vs due time), so normalise everything on the way in.
const iso = (value: unknown) => new Date(value as string).toISOString();
const isoOrUndefined = (value: unknown) => (value == null ? undefined : iso(value));
const num = (value: unknown) => Number(value);
const audit = (row: Row) => ({
  createdBy: (row.created_by as string | null) ?? undefined,
  updatedBy: (row.updated_by as string | null) ?? undefined,
  updatedAt: isoOrUndefined(row.updated_at),
});

export function clientToRow(c: Client): Row {
  return {
    id: c.id,
    name: c.name,
    contact: c.contact,
    phone: c.phone,
    email: c.email,
    address: c.address,
    rate_per_litre: c.ratePerLitre,
    credit_days: c.creditDays,
  };
}

export function clientFromRow(r: Row): Client {
  return {
    id: r.id as string,
    name: r.name as string,
    contact: r.contact as string,
    phone: r.phone as string,
    email: r.email as string,
    address: r.address as string,
    ratePerLitre: num(r.rate_per_litre),
    creditDays: num(r.credit_days),
    ...audit(r),
  };
}

export function truckToRow(t: Truck): Row {
  return {
    id: t.id,
    plate: t.plate,
    capacity_litres: t.capacityLitres,
    odometer_km: t.odometerKm,
    next_service_km: t.nextServiceKm,
    insurance_expiry: t.insuranceExpiry,
    inspection_expiry: t.inspectionExpiry,
  };
}

export function truckFromRow(r: Row): Truck {
  return {
    id: r.id as string,
    plate: r.plate as string,
    capacityLitres: num(r.capacity_litres),
    odometerKm: num(r.odometer_km),
    nextServiceKm: num(r.next_service_km),
    insuranceExpiry: r.insurance_expiry as string,
    inspectionExpiry: r.inspection_expiry as string,
    ...audit(r),
  };
}

export function driverToRow(d: Driver): Row {
  return { id: d.id, name: d.name, phone: d.phone, license_no: d.licenseNo, license_expiry: d.licenseExpiry };
}

export function driverFromRow(r: Row): Driver {
  return {
    id: r.id as string,
    name: r.name as string,
    phone: r.phone as string,
    licenseNo: r.license_no as string,
    licenseExpiry: r.license_expiry as string,
    ...audit(r),
  };
}

export function tripToRow(t: Trip): Row {
  return {
    id: t.id,
    ref: t.ref,
    client_id: t.clientId,
    truck_id: t.truckId,
    driver_id: t.driverId,
    product: t.product,
    origin: t.origin,
    destination: t.destination,
    litres_loaded: t.litresLoaded,
    rate_per_litre: t.ratePerLitre,
    dispatched_at: t.dispatchedAt,
    due_at: t.dueAt,
    litres_delivered: t.delivery?.litresDelivered ?? null,
    arrived_at: t.delivery?.arrivedAt ?? null,
    cost_fuel: t.delivery?.costs.fuel ?? null,
    cost_allowance: t.delivery?.costs.allowance ?? null,
    cost_tolls: t.delivery?.costs.tolls ?? null,
    cost_other: t.delivery?.costs.other ?? null,
    pod_received: t.delivery?.podReceived ?? null,
    invoice_no: t.billing?.invoiceNo ?? null,
    invoiced_at: t.billing?.invoicedAt ?? null,
    paid_at: t.billing?.paidAt ?? null,
    loss_reviewed: !!t.lossReviewed,
  };
}

export function tripFromRow(r: Row): Trip {
  const trip: Trip = {
    id: r.id as string,
    ref: r.ref as string,
    clientId: r.client_id as string,
    truckId: r.truck_id as string,
    driverId: r.driver_id as string,
    product: r.product as Trip['product'],
    origin: r.origin as string,
    destination: r.destination as string,
    litresLoaded: num(r.litres_loaded),
    ratePerLitre: num(r.rate_per_litre),
    dispatchedAt: iso(r.dispatched_at),
    dueAt: iso(r.due_at),
    lossReviewed: r.loss_reviewed === true ? true : undefined,
    ...audit(r),
  };
  if (r.litres_delivered != null) {
    trip.delivery = {
      litresDelivered: num(r.litres_delivered),
      arrivedAt: iso(r.arrived_at),
      costs: {
        fuel: num(r.cost_fuel ?? 0),
        allowance: num(r.cost_allowance ?? 0),
        tolls: num(r.cost_tolls ?? 0),
        other: num(r.cost_other ?? 0),
      },
      podReceived: r.pod_received === true,
    };
  }
  if (r.invoiced_at != null) {
    trip.billing = {
      invoiceNo: (r.invoice_no as string | null) ?? '',
      invoicedAt: iso(r.invoiced_at),
      paidAt: isoOrUndefined(r.paid_at),
    };
  }
  return trip;
}

export function notificationToRow(n: AppNotification): Row {
  return { id: n.id, kind: n.kind, trip_id: n.tripId, title: n.title, body: n.body, at: n.at };
}

export function notificationFromRow(r: Row): AppNotification {
  return {
    id: r.id as string,
    kind: r.kind as AppNotification['kind'],
    tripId: r.trip_id as string,
    title: r.title as string,
    body: r.body as string,
    at: iso(r.at),
    ...audit(r),
  };
}

export function staffFromRow(r: Row): Staff {
  return {
    id: r.id as string,
    name: r.full_name as string,
    email: r.email as string,
    role: r.role === 'manager' ? 'manager' : 'dispatcher',
    active: r.active !== false,
    notificationsReadAt: iso(r.notifications_read_at),
  };
}

/** The columns that differ between two versions of a row; empty if nothing changed. */
export function changedColumns(before: Row, after: Row): Row {
  const patch: Row = {};
  for (const key of Object.keys(after)) {
    if (key === 'id') continue;
    if (!sameValue(before[key], after[key])) patch[key] = after[key];
  }
  return patch;
}

function sameValue(a: unknown, b: unknown) {
  if (a == null && b == null) return true;
  return a === b;
}
