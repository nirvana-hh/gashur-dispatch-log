import { computeFigures, formatMoney } from '@/lib/calc';
import { readItem, removeItem, writeItem } from '@/lib/persist';
import {
  changedColumns,
  clientToRow,
  driverToRow,
  notificationToRow,
  tripToRow,
  truckToRow,
  type Row,
  type Table,
} from '@/lib/rows';
import { isSupabaseConfigured } from '@/lib/supabase';

export type Product = 'PMS' | 'AGO' | 'DPK';

/** Who created and last changed a record, filled in by the server once it syncs. */
export type Audited = {
  createdBy?: string;
  updatedBy?: string;
  updatedAt?: string;
};

export type Client = Audited & {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  /** Haulage rate charged per litre delivered. */
  ratePerLitre: number;
  /** Days after invoicing before an unpaid invoice counts as overdue. */
  creditDays: number;
};

export type Truck = Audited & {
  id: string;
  plate: string;
  capacityLitres: number;
  odometerKm: number;
  nextServiceKm: number;
  /** ISO dates (YYYY-MM-DD). */
  insuranceExpiry: string;
  inspectionExpiry: string;
};

export type Driver = Audited & {
  id: string;
  name: string;
  phone: string;
  licenseNo: string;
  /** ISO date (YYYY-MM-DD). */
  licenseExpiry: string;
};

export type TripCosts = {
  fuel: number;
  allowance: number;
  tolls: number;
  other: number;
};

export type Trip = Audited & {
  id: string;
  /** Human-readable reference, e.g. GSH-0042. */
  ref: string;
  clientId: string;
  truckId: string;
  driverId: string;
  product: Product;
  origin: string;
  destination: string;
  litresLoaded: number;
  /** Copied from the client at dispatch so later rate changes don't rewrite history. */
  ratePerLitre: number;
  dispatchedAt: string;
  /** When the load is due at the customer; decides on-time status. */
  dueAt: string;
  delivery?: {
    litresDelivered: number;
    arrivedAt: string;
    costs: TripCosts;
    podReceived: boolean;
  };
  billing?: {
    invoiceNo: string;
    invoicedAt: string;
    paidAt?: string;
  };
  /** Set when a manager has cleared a loss flag. */
  lossReviewed?: boolean;
};

export type NotificationKind = 'dispatched' | 'delivered' | 'billed' | 'paid' | 'loss';

export type AppNotification = Audited & {
  id: string;
  kind: NotificationKind;
  tripId: string;
  title: string;
  body: string;
  at: string;
};

export type Role = 'manager' | 'dispatcher';

export type Staff = {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** False once a manager has removed their access; they stay listed on their records. */
  active: boolean;
  notificationsReadAt: string;
};

export type State = {
  trips: Trip[];
  trucks: Truck[];
  drivers: Driver[];
  clients: Client[];
  notifications: AppNotification[];
  /** Everyone with an account, so records can show who made them. Empty in local demo mode. */
  staff: Staff[];
  /** Notifications newer than this are unread for the signed-in person (or this device). */
  notificationsReadAt: string;
};

export const Products: Product[] = ['PMS', 'AGO', 'DPK'];

export const ProductInfo: Record<Product, { label: string; color: string; pricePerLitre: number }> = {
  PMS: { label: 'Petrol (PMS)', color: '#22C55E', pricePerLitre: 1.35 },
  AGO: { label: 'Diesel (AGO)', color: '#EAB308', pricePerLitre: 1.3 },
  DPK: { label: 'Kerosene (DPK)', color: '#8B5CF6', pricePerLitre: 1.15 },
};

export const Depots = ['Kampala Depot', 'Jinja Depot', 'Nakasongola Depot'];

// Store
//
// This in-memory state, saved to the device after every change, is the local cache the
// screens read from, so they never wait on the network. When Supabase is configured,
// every change also becomes a list of row operations that the sync engine
// (src/lib/sync.ts) queues and pushes, and changes from other staff are merged back
// in with `applyRemote`. Without Supabase the app runs as a local demo.

const STORAGE_KEY = isSupabaseConfigured ? 'gashur:cache:v1' : 'gashur:v3';

let state: State | null = null;
const listeners = new Set<() => void>();

/** A change to push to Supabase: a full row for new records, changed columns otherwise. */
export type Op = { table: Table; id: string; kind: 'insert' | 'update'; values: Row };

const changeListeners = new Set<(ops: Op[]) => void>();

/** Lets the sync engine hear about local changes without the store importing it. */
export function onLocalChanges(listener: (ops: Op[]) => void) {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

/** The signed-in user, stamped on new records so they show their author before syncing. */
let actorId: string | undefined;

export function setActor(id: string | undefined) {
  actorId = id;
}

/**
 * The whole app state. Each slice keeps its array reference until it changes,
 * so `useSyncExternalStore` selectors over it stay stable.
 */
export function getState(): State {
  if (state === null) {
    state = load();
  }
  return state;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function update(patch: Partial<State>, ops: Op[] = []) {
  state = { ...getState(), ...patch };
  writeItem(STORAGE_KEY, JSON.stringify(state));
  listeners.forEach((listener) => listener());
  const real = ops.filter((op) => op.kind === 'insert' || Object.keys(op.values).length > 0);
  if (real.length > 0) changeListeners.forEach((listener) => listener(real));
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function stamp<T extends Audited>(item: T): T {
  return { ...item, createdBy: item.createdBy ?? actorId, updatedBy: actorId };
}

function notify(trip: Trip, kind: NotificationKind, title: string, body: string): AppNotification {
  return stamp<AppNotification>({ id: newId(), kind, tripId: trip.id, title, body, at: new Date().toISOString() });
}

function clientName(id: string) {
  return getState().clients.find((c) => c.id === id)?.name ?? 'Unknown client';
}

const insertOp = (table: Table, id: string, values: Row): Op => ({ table, id, kind: 'insert', values });
const updateOp = (table: Table, id: string, before: Row, after: Row): Op => ({
  table,
  id,
  kind: 'update',
  values: changedColumns(before, after),
});
const deleteOp = (table: Table, id: string): Op => ({
  table,
  id,
  kind: 'update',
  values: { deleted_at: new Date().toISOString() },
});
const notificationOps = (events: AppNotification[]) => events.map((n) => insertOp('notifications', n.id, notificationToRow(n)));

// Trip actions

export type DispatchInput = Omit<Trip, keyof Audited | 'id' | 'ref' | 'delivery' | 'billing' | 'lossReviewed'>;

export function dispatchTrip(input: DispatchInput): string {
  const { trips, notifications } = getState();
  const next = Math.max(0, ...trips.map((t) => Number(t.ref.slice(4)) || 0)) + 1;
  const trip = stamp<Trip>({ ...input, id: newId(), ref: `GSH-${String(next).padStart(4, '0')}` });
  const event = notify(trip, 'dispatched', `${trip.ref} dispatched`, `${trip.litresLoaded.toLocaleString()} L ${trip.product} to ${clientName(trip.clientId)}, ${trip.destination}`);
  update({ trips: [trip, ...trips], notifications: [event, ...notifications] }, [
    insertOp('trips', trip.id, tripToRow(trip)),
    ...notificationOps([event]),
  ]);
  return trip.id;
}

export function updateDispatch(id: string, input: DispatchInput) {
  updateTrip(id, (trip) => ({ ...trip, ...input }));
}

export function recordDelivery(id: string, delivery: NonNullable<Trip['delivery']>) {
  const trip = getState().trips.find((t) => t.id === id);
  if (!trip) return;
  const lossFlagged = !!computeFigures(trip, delivery)?.lossFlagged;
  const updated: Trip = { ...trip, delivery };
  const events: AppNotification[] = [];
  const alreadyAlerted = getState().notifications.some((n) => n.tripId === id && n.kind === 'loss');
  if (lossFlagged && !alreadyAlerted) {
    const loss = trip.litresLoaded - delivery.litresDelivered;
    events.push(notify(updated, 'loss', `Fuel loss on ${trip.ref}`, `${loss.toLocaleString()} L short, above tolerance. Needs review.`));
  }
  if (!trip.delivery) {
    events.push(notify(updated, 'delivered', `${trip.ref} delivered`, `${delivery.litresDelivered.toLocaleString()} L received by ${clientName(trip.clientId)}`));
  }
  replaceTrip(trip, updated, events);
}

export function recordInvoice(id: string, invoiceNo: string, invoicedAt: string, amount: number) {
  const trip = getState().trips.find((t) => t.id === id);
  if (!trip) return;
  const updated: Trip = { ...trip, billing: { ...trip.billing, invoiceNo, invoicedAt } };
  replaceTrip(
    trip,
    updated,
    trip.billing
      ? []
      : [notify(updated, 'billed', `${trip.ref} invoiced`, `Invoice ${invoiceNo} for ${formatMoney(amount)} sent to ${clientName(trip.clientId)}`)],
  );
}

export function setPaid(id: string, paid: boolean) {
  const trip = getState().trips.find((t) => t.id === id);
  if (!trip?.billing) return;
  const updated: Trip = { ...trip, billing: { ...trip.billing, paidAt: paid ? new Date().toISOString() : undefined } };
  replaceTrip(trip, updated, paid ? [notify(updated, 'paid', `${trip.ref} paid`, `${clientName(trip.clientId)} paid invoice ${trip.billing.invoiceNo}`)] : []);
}

/** Manager only: the server rejects this from dispatchers. */
export function markLossReviewed(id: string) {
  updateTrip(id, (trip) => ({ ...trip, lossReviewed: true }));
}

/** Manager only. The trip and its notifications are marked deleted so the deletion syncs. */
export function deleteTrip(id: string) {
  const { trips, notifications } = getState();
  const gone = notifications.filter((n) => n.tripId === id);
  update(
    {
      trips: trips.filter((t) => t.id !== id),
      notifications: notifications.filter((n) => n.tripId !== id),
    },
    [...gone.map((n) => deleteOp('notifications', n.id)), deleteOp('trips', id)],
  );
}

function updateTrip(id: string, change: (trip: Trip) => Trip) {
  const trip = getState().trips.find((t) => t.id === id);
  if (trip) replaceTrip(trip, change(trip), []);
}

function replaceTrip(before: Trip, after: Trip, events: AppNotification[]) {
  const { trips, notifications } = getState();
  const updated = stamp(after);
  update(
    {
      trips: trips.map((t) => (t.id === updated.id ? updated : t)),
      notifications: events.length > 0 ? [...events.reverse(), ...notifications] : notifications,
    },
    [updateOp('trips', updated.id, tripToRow(before), tripToRow(updated)), ...notificationOps(events)],
  );
}

// Fleet and client actions

type Saveable = 'trucks' | 'drivers' | 'clients';

const toRow: { [K in Saveable]: (item: State[K][number]) => Row } = {
  trucks: (t) => truckToRow(t as Truck),
  drivers: (d) => driverToRow(d as Driver),
  clients: (c) => clientToRow(c as Client),
};

function save<K extends Saveable>(key: K, item: Omit<State[K][number], 'id' | keyof Audited> & { id?: string }) {
  const list = getState()[key] as State[K][number][];
  const existing = item.id ? list.find((e) => e.id === item.id) : undefined;
  const rowOf = toRow[key] as (item: State[K][number]) => Row;
  if (existing) {
    const next = stamp({ ...existing, ...item }) as State[K][number];
    update({ [key]: list.map((e) => (e.id === existing.id ? next : e)) } as Partial<State>, [
      updateOp(key, existing.id, rowOf(existing), rowOf(next)),
    ]);
  } else {
    const created = stamp({ ...item, id: newId() } as State[K][number]);
    update({ [key]: [...list, created] } as Partial<State>, [insertOp(key, created.id, rowOf(created))]);
  }
}

export const saveTruck = (truck: Omit<Truck, 'id' | keyof Audited> & { id?: string }) => save('trucks', truck);
export const saveDriver = (driver: Omit<Driver, 'id' | keyof Audited> & { id?: string }) => save('drivers', driver);
export const saveClient = (client: Omit<Client, 'id' | keyof Audited> & { id?: string }) => save('clients', client);

/** Manager only, like every deletion. */
export function removeTruck(id: string) {
  update({ trucks: getState().trucks.filter((t) => t.id !== id) }, [deleteOp('trucks', id)]);
}

export function removeDriver(id: string) {
  update({ drivers: getState().drivers.filter((d) => d.id !== id) }, [deleteOp('drivers', id)]);
}

export function removeClient(id: string) {
  update({ clients: getState().clients.filter((c) => c.id !== id) }, [deleteOp('clients', id)]);
}

// Notifications

export function markAllRead() {
  const { notifications, notificationsReadAt } = getState();
  if (!notifications.some((n) => n.at > notificationsReadAt)) return;
  const now = new Date().toISOString();
  update(
    { notificationsReadAt: now },
    actorId ? [{ table: 'profiles', id: actorId, kind: 'update', values: { notifications_read_at: now } }] : [],
  );
}

// Syncing

type Slice = 'trips' | 'trucks' | 'drivers' | 'clients' | 'notifications' | 'staff';

/**
 * Merges rows pulled from Supabase into the cache. Records with changes still waiting to
 * be pushed keep their local version; deleted ones are dropped.
 */
export function applyRemote<K extends Slice>(slice: K, incoming: { item: State[K][number]; deleted: boolean }[], pending: Set<string>) {
  if (incoming.length === 0) return;
  const list = getState()[slice] as State[K][number][];
  const byId = new Map(list.map((item) => [item.id, item]));
  for (const { item, deleted } of incoming) {
    if (pending.has(item.id)) continue;
    if (deleted) byId.delete(item.id);
    else byId.set(item.id, item);
  }
  let next = [...byId.values()];
  if (slice === 'trips') next = (next as Trip[]).sort((a, b) => b.dispatchedAt.localeCompare(a.dispatchedAt)) as typeof next;
  if (slice === 'notifications') next = (next as AppNotification[]).sort((a, b) => b.at.localeCompare(a.at)) as typeof next;
  update({ [slice]: next } as Partial<State>);
}

/** Uses the signed-in person's read time from their profile, so it follows them across devices. */
export function applyReadTime(readAt: string) {
  if (readAt > getState().notificationsReadAt) update({ notificationsReadAt: readAt });
}

/** Clears the cache, e.g. on sign-out, so the next person on this device starts clean. */
export function resetCache() {
  removeItem(STORAGE_KEY);
  state = emptyState();
  listeners.forEach((listener) => listener());
}

/** Manager only: fills an empty company database with the demo month, through the normal sync. */
export function loadDemoData() {
  const demo = seed();
  const current = getState();
  update(
    {
      trips: [...demo.trips, ...current.trips],
      trucks: [...current.trucks, ...demo.trucks],
      drivers: [...current.drivers, ...demo.drivers],
      clients: [...current.clients, ...demo.clients],
      notifications: [...demo.notifications, ...current.notifications],
    },
    [
      // Parents first, so foreign keys hold when the queue is pushed in order.
      ...demo.clients.map((c) => insertOp('clients', c.id, clientToRow(c))),
      ...demo.trucks.map((t) => insertOp('trucks', t.id, truckToRow(t))),
      ...demo.drivers.map((d) => insertOp('drivers', d.id, driverToRow(d))),
      ...demo.trips.map((t) => insertOp('trips', t.id, tripToRow(t))),
      ...demo.notifications.map((n) => insertOp('notifications', n.id, notificationToRow(n))),
    ],
  );
}

// Persistence

function emptyState(): State {
  return { trips: [], trucks: [], drivers: [], clients: [], notifications: [], staff: [], notificationsReadAt: new Date(0).toISOString() };
}

function load(): State {
  const raw = readItem(STORAGE_KEY);
  if (raw) {
    try {
      return { ...emptyState(), ...(JSON.parse(raw) as Partial<State>) };
    } catch {
      // Fall through and start again if the cache is unreadable.
    }
  }
  // Signed-in mode starts empty and fills from Supabase; the local demo seeds itself.
  if (isSupabaseConfigured) return emptyState();
  const seeded = seed();
  writeItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

/** About a month of demo data, relative to now, so every screen has something to show. */
function seed(): State {
  const now = Date.now();
  const hour = 3_600_000;
  const day = 24 * hour;
  const iso = (offset: number) => new Date(now + offset).toISOString();
  const date = (days: number) => iso(days * day).slice(0, 10);

  const clients: Client[] = [
    { id: 'demo-c1', name: 'Northstar Filling Stations', contact: 'Ibrahim Musa', phone: '0772 555 0142', email: 'accounts@northstar.example', address: 'Gulu', ratePerLitre: 0.06, creditDays: 30 },
    { id: 'demo-c2', name: 'Delta Aviation Services', contact: 'Ngozi Eze', phone: '0782 555 0178', email: 'finance@deltaaviation.example', address: 'Entebbe Airport', ratePerLitre: 0.072, creditDays: 14 },
    { id: 'demo-c3', name: 'Crescent Power Ltd', contact: 'Tunde Bakare', phone: '0701 555 0119', email: 'ap@crescentpower.example', address: 'Mbarara', ratePerLitre: 0.065, creditDays: 21 },
    { id: 'demo-c4', name: 'Greenfield Farms', contact: 'Aisha Bello', phone: '0752 555 0163', email: 'office@greenfield.example', address: 'Fort Portal', ratePerLitre: 0.055, creditDays: 7 },
  ];

  const trucks: Truck[] = [
    { id: 'demo-t1', plate: 'UBK 101A', capacityLitres: 33000, odometerKm: 184_250, nextServiceKm: 185_000, insuranceExpiry: date(120), inspectionExpiry: date(45) },
    { id: 'demo-t2', plate: 'UBK 102A', capacityLitres: 33000, odometerKm: 142_900, nextServiceKm: 150_000, insuranceExpiry: date(12), inspectionExpiry: date(200) },
    { id: 'demo-t3', plate: 'UBL 104B', capacityLitres: 45000, odometerKm: 98_400, nextServiceKm: 105_000, insuranceExpiry: date(260), inspectionExpiry: date(-3) },
    { id: 'demo-t4', plate: 'UBL 107B', capacityLitres: 45000, odometerKm: 221_700, nextServiceKm: 230_000, insuranceExpiry: date(90), inspectionExpiry: date(150) },
    { id: 'demo-t5', plate: 'UBM 110C', capacityLitres: 33000, odometerKm: 64_100, nextServiceKm: 70_000, insuranceExpiry: date(300), inspectionExpiry: date(80) },
  ];

  const drivers: Driver[] = [
    { id: 'demo-d1', name: 'Musa Abdullahi', phone: '0772 555 0101', licenseNo: 'UG-88213-AA', licenseExpiry: date(400) },
    { id: 'demo-d2', name: 'Chinedu Okafor', phone: '0782 555 0102', licenseNo: 'UG-44120-BC', licenseExpiry: date(18) },
    { id: 'demo-d3', name: 'Yusuf Danjuma', phone: '0701 555 0103', licenseNo: 'UG-90931-DF', licenseExpiry: date(220) },
    { id: 'demo-d4', name: 'Emeka Nwosu', phone: '0752 555 0104', licenseNo: 'UG-12904-GH', licenseExpiry: date(-6) },
    { id: 'demo-d5', name: 'Sani Lawal', phone: '0774 555 0105', licenseNo: 'UG-55018-JK', licenseExpiry: date(500) },
  ];

  const costs = (fuel: number): TripCosts => ({ fuel: Math.round(fuel * 1.4), allowance: 120, tolls: 40, other: 60 });

  // [client, truck, driver, product, depot, destination, loaded, days ago dispatched, transit hours,
  //  delivered (null = still on the road), late hours, fuel cost, invoiced days after delivery, paid days after invoice]
  type Row = [number, number, number, Product, number, string, number, number, number, number | null, number, number, number | null, number | null];
  const rows: Row[] = [
    [0, 0, 0, 'PMS', 0, 'Gulu', 33000, 0.4, 10, null, 0, 0, null, null],
    [2, 3, 4, 'AGO', 0, 'Mbarara', 45000, 0.2, 8, null, 0, 0, null, null],
    [1, 2, 3, 'DPK', 2, 'Entebbe Airport', 45000, 1.2, 3, 44790, 0, 210, null, null],
    [3, 4, 1, 'AGO', 0, 'Fort Portal', 33000, 2.5, 9, 32910, 3, 420, 1, null],
    [0, 1, 2, 'PMS', 1, 'Gulu', 33000, 4, 10, 32640, 0, 450, 1, null],
    [2, 0, 0, 'AGO', 0, 'Mbarara', 33000, 6, 8, 32950, 0, 380, 1, 10],
    [1, 2, 3, 'DPK', 2, 'Entebbe Airport', 45000, 9, 3, 44880, 0, 200, 0, null],
    [0, 3, 4, 'PMS', 0, 'Gulu', 45000, 12, 10, 44850, 5, 560, 1, 15],
    [3, 4, 1, 'AGO', 1, 'Fort Portal', 33000, 15, 9, 32930, 0, 410, 1, null],
    [2, 1, 2, 'AGO', 0, 'Mbarara', 33000, 18, 8, 32900, 0, 390, 1, 12],
    [0, 0, 0, 'PMS', 1, 'Gulu', 33000, 22, 10, 32960, 0, 455, 1, 20],
    [1, 2, 3, 'DPK', 2, 'Entebbe Airport', 45000, 26, 3, 44910, 2, 205, 1, 9],
    [3, 3, 4, 'AGO', 0, 'Fort Portal', 45000, 28, 9, 44700, 0, 530, 2, 6],
  ];

  const trips: Trip[] = rows.map((row, i) => {
    const [c, t, d, product, depot, destination, loaded, daysAgo, transit, delivered, late, fuel, invoicedAfter, paidAfter] = row;
    const dispatched = -daysAgo * day;
    const arrived = dispatched + (transit + late) * hour;
    const trip: Trip = {
      id: `demo-trip-${i}`,
      ref: `GSH-${String(rows.length - i).padStart(4, '0')}`,
      clientId: clients[c].id,
      truckId: trucks[t].id,
      driverId: drivers[d].id,
      product,
      origin: Depots[depot],
      destination,
      litresLoaded: loaded,
      ratePerLitre: clients[c].ratePerLitre,
      dispatchedAt: iso(dispatched),
      dueAt: iso(dispatched + transit * hour),
    };
    if (delivered !== null) {
      trip.delivery = { litresDelivered: delivered, arrivedAt: iso(arrived), costs: costs(fuel), podReceived: i !== 3 };
      if (invoicedAfter !== null) {
        const invoiced = arrived + invoicedAfter * day;
        trip.billing = {
          invoiceNo: `INV-${2400 + rows.length - i}`,
          invoicedAt: iso(invoiced),
          paidAt: paidAfter !== null ? iso(invoiced + paidAfter * day) : undefined,
        };
      }
    }
    return trip;
  });

  const notifications: AppNotification[] = trips.slice(0, 5).flatMap((trip) => {
    const client = clients.find((c) => c.id === trip.clientId)!.name;
    const list: AppNotification[] = [];
    if (trip.billing) {
      list.push({ id: `demo-n-b-${trip.id}`, kind: 'billed', tripId: trip.id, title: `${trip.ref} invoiced`, body: `Invoice ${trip.billing.invoiceNo} sent to ${client}`, at: trip.billing.invoicedAt });
    }
    if (trip.delivery) {
      list.push({ id: `demo-n-d-${trip.id}`, kind: 'delivered', tripId: trip.id, title: `${trip.ref} delivered`, body: `${trip.delivery.litresDelivered.toLocaleString()} L received by ${client}`, at: trip.delivery.arrivedAt });
    }
    list.push({ id: `demo-n-s-${trip.id}`, kind: 'dispatched', tripId: trip.id, title: `${trip.ref} dispatched`, body: `${trip.litresLoaded.toLocaleString()} L ${trip.product} to ${client}, ${trip.destination}`, at: trip.dispatchedAt });
    return list;
  });
  // Seed trip GSH-0009 (index 4) is short by 360 L, above tolerance.
  notifications.push({ id: 'demo-n-loss', kind: 'loss', tripId: trips[4].id, title: `Fuel loss on ${trips[4].ref}`, body: '360 L short, above tolerance. Needs review.', at: trips[4].delivery!.arrivedAt });
  notifications.sort((a, b) => b.at.localeCompare(a.at));

  // The oldest invoice notices start out read; everything after them is new.
  const notificationsReadAt = iso(-3 * day);
  return { trips, trucks, drivers, clients, notifications, staff: [], notificationsReadAt };
}
