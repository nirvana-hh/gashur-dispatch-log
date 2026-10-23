import { computeFigures, formatMoney } from '@/lib/calc';
import { readItem, writeItem } from '@/lib/persist';

export type Product = 'PMS' | 'AGO' | 'DPK';

export type Client = {
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

export type Truck = {
  id: string;
  plate: string;
  capacityLitres: number;
  odometerKm: number;
  nextServiceKm: number;
  /** ISO dates (YYYY-MM-DD). */
  insuranceExpiry: string;
  inspectionExpiry: string;
};

export type Driver = {
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

export type Trip = {
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

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  tripId: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
};

export type State = {
  trips: Trip[];
  trucks: Truck[];
  drivers: Driver[];
  clients: Client[];
  notifications: AppNotification[];
};

export const Products: Product[] = ['PMS', 'AGO', 'DPK'];

export const ProductInfo: Record<Product, { label: string; color: string; pricePerLitre: number }> = {
  PMS: { label: 'Petrol (PMS)', color: '#22C55E', pricePerLitre: 1.35 },
  AGO: { label: 'Diesel (AGO)', color: '#EAB308', pricePerLitre: 1.3 },
  DPK: { label: 'Kerosene (DPK)', color: '#8B5CF6', pricePerLitre: 1.15 },
};

export const Depots = ['Kampala Depot', 'Jinja Depot', 'Nakasongola Depot'];

// Store

const STORAGE_KEY = 'gashur:v2';

let state: State | null = null;
const listeners = new Set<() => void>();

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

function update(patch: Partial<State>) {
  state = { ...getState(), ...patch };
  writeItem(STORAGE_KEY, JSON.stringify(state));
  listeners.forEach((listener) => listener());
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function notify(trip: Trip, kind: NotificationKind, title: string, body: string): AppNotification {
  return { id: newId(), kind, tripId: trip.id, title, body, at: new Date().toISOString(), read: false };
}

function clientName(id: string) {
  return getState().clients.find((c) => c.id === id)?.name ?? 'Unknown client';
}

// Trip actions

export type DispatchInput = Omit<Trip, 'id' | 'ref' | 'delivery' | 'billing' | 'lossReviewed'>;

export function dispatchTrip(input: DispatchInput): string {
  const { trips, notifications } = getState();
  const next = Math.max(0, ...trips.map((t) => Number(t.ref.slice(4)) || 0)) + 1;
  const trip: Trip = { ...input, id: newId(), ref: `GSH-${String(next).padStart(4, '0')}` };
  update({
    trips: [trip, ...trips],
    notifications: [
      notify(trip, 'dispatched', `${trip.ref} dispatched`, `${trip.litresLoaded.toLocaleString()} L ${trip.product} to ${clientName(trip.clientId)}, ${trip.destination}`),
      ...notifications,
    ],
  });
  return trip.id;
}

export function updateDispatch(id: string, input: DispatchInput) {
  updateTrip(id, (trip) => ({ ...trip, ...input }));
}

export function recordDelivery(id: string, delivery: NonNullable<Trip['delivery']>) {
  const trip = getState().trips.find((t) => t.id === id);
  if (!trip) return;
  const lossFlagged = !!computeFigures(trip, delivery)?.lossFlagged;
  const firstTime = !trip.delivery;
  const updated: Trip = { ...trip, delivery, lossReviewed: lossFlagged ? trip.lossReviewed : undefined };
  const events: AppNotification[] = [];
  if (firstTime) {
    events.push(notify(updated, 'delivered', `${trip.ref} delivered`, `${delivery.litresDelivered.toLocaleString()} L received by ${clientName(trip.clientId)}`));
  }
  const alreadyAlerted = getState().notifications.some((n) => n.tripId === id && n.kind === 'loss');
  if (lossFlagged && !alreadyAlerted) {
    const loss = trip.litresLoaded - delivery.litresDelivered;
    events.push(notify(updated, 'loss', `Fuel loss on ${trip.ref}`, `${loss.toLocaleString()} L short, above tolerance. Needs review.`));
  }
  replaceTrip(updated, events);
}

export function recordInvoice(id: string, invoiceNo: string, invoicedAt: string, amount: number) {
  const trip = getState().trips.find((t) => t.id === id);
  if (!trip) return;
  const firstTime = !trip.billing;
  const updated: Trip = { ...trip, billing: { ...trip.billing, invoiceNo, invoicedAt } };
  replaceTrip(
    updated,
    firstTime
      ? [notify(updated, 'billed', `${trip.ref} invoiced`, `Invoice ${invoiceNo} for ${formatMoney(amount)} sent to ${clientName(trip.clientId)}`)]
      : [],
  );
}

export function setPaid(id: string, paid: boolean) {
  const trip = getState().trips.find((t) => t.id === id);
  if (!trip?.billing) return;
  const updated: Trip = { ...trip, billing: { ...trip.billing, paidAt: paid ? new Date().toISOString() : undefined } };
  replaceTrip(updated, paid ? [notify(updated, 'paid', `${trip.ref} paid`, `${clientName(trip.clientId)} paid invoice ${trip.billing.invoiceNo}`)] : []);
}

export function markLossReviewed(id: string) {
  updateTrip(id, (trip) => ({ ...trip, lossReviewed: true }));
}

export function deleteTrip(id: string) {
  const { trips, notifications } = getState();
  update({
    trips: trips.filter((t) => t.id !== id),
    notifications: notifications.filter((n) => n.tripId !== id),
  });
}

function updateTrip(id: string, change: (trip: Trip) => Trip) {
  update({ trips: getState().trips.map((t) => (t.id === id ? change(t) : t)) });
}

function replaceTrip(trip: Trip, events: AppNotification[]) {
  const { trips, notifications } = getState();
  update({
    trips: trips.map((t) => (t.id === trip.id ? trip : t)),
    notifications: events.length > 0 ? [...events.reverse(), ...notifications] : notifications,
  });
}

// Fleet and client actions

type Saveable = 'trucks' | 'drivers' | 'clients';

function save<K extends Saveable>(key: K, item: Omit<State[K][number], 'id'> & { id?: string }) {
  const list = getState()[key] as { id: string }[];
  const next = item.id
    ? list.map((existing) => (existing.id === item.id ? { ...existing, ...item } : existing))
    : [...list, { ...item, id: newId() }];
  update({ [key]: next } as Partial<State>);
}

export const saveTruck = (truck: Omit<Truck, 'id'> & { id?: string }) => save('trucks', truck);
export const saveDriver = (driver: Omit<Driver, 'id'> & { id?: string }) => save('drivers', driver);
export const saveClient = (client: Omit<Client, 'id'> & { id?: string }) => save('clients', client);

export function removeTruck(id: string) {
  update({ trucks: getState().trucks.filter((t) => t.id !== id) });
}

export function removeDriver(id: string) {
  update({ drivers: getState().drivers.filter((d) => d.id !== id) });
}

export function removeClient(id: string) {
  update({ clients: getState().clients.filter((c) => c.id !== id) });
}

// Notifications

export function markAllRead() {
  const { notifications } = getState();
  if (notifications.every((n) => n.read)) return;
  update({ notifications: notifications.map((n) => (n.read ? n : { ...n, read: true })) });
}

// Persistence

function load(): State {
  const raw = readItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as State;
    } catch {
      // Fall through and reseed if the stored data is unreadable.
    }
  }
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
    { id: 'c1', name: 'Northstar Filling Stations', contact: 'Ibrahim Musa', phone: '0772 555 0142', email: 'accounts@northstar.example', address: 'Gulu', ratePerLitre: 0.06, creditDays: 30 },
    { id: 'c2', name: 'Delta Aviation Services', contact: 'Ngozi Eze', phone: '0782 555 0178', email: 'finance@deltaaviation.example', address: 'Entebbe Airport', ratePerLitre: 0.072, creditDays: 14 },
    { id: 'c3', name: 'Crescent Power Ltd', contact: 'Tunde Bakare', phone: '0701 555 0119', email: 'ap@crescentpower.example', address: 'Mbarara', ratePerLitre: 0.065, creditDays: 21 },
    { id: 'c4', name: 'Greenfield Farms', contact: 'Aisha Bello', phone: '0752 555 0163', email: 'office@greenfield.example', address: 'Fort Portal', ratePerLitre: 0.055, creditDays: 7 },
  ];

  const trucks: Truck[] = [
    { id: 't1', plate: 'UBK 101A', capacityLitres: 33000, odometerKm: 184_250, nextServiceKm: 185_000, insuranceExpiry: date(120), inspectionExpiry: date(45) },
    { id: 't2', plate: 'UBK 102A', capacityLitres: 33000, odometerKm: 142_900, nextServiceKm: 150_000, insuranceExpiry: date(12), inspectionExpiry: date(200) },
    { id: 't3', plate: 'UBL 104B', capacityLitres: 45000, odometerKm: 98_400, nextServiceKm: 105_000, insuranceExpiry: date(260), inspectionExpiry: date(-3) },
    { id: 't4', plate: 'UBL 107B', capacityLitres: 45000, odometerKm: 221_700, nextServiceKm: 230_000, insuranceExpiry: date(90), inspectionExpiry: date(150) },
    { id: 't5', plate: 'UBM 110C', capacityLitres: 33000, odometerKm: 64_100, nextServiceKm: 70_000, insuranceExpiry: date(300), inspectionExpiry: date(80) },
  ];

  const drivers: Driver[] = [
    { id: 'd1', name: 'Musa Abdullahi', phone: '0772 555 0101', licenseNo: 'UG-88213-AA', licenseExpiry: date(400) },
    { id: 'd2', name: 'Chinedu Okafor', phone: '0782 555 0102', licenseNo: 'UG-44120-BC', licenseExpiry: date(18) },
    { id: 'd3', name: 'Yusuf Danjuma', phone: '0701 555 0103', licenseNo: 'UG-90931-DF', licenseExpiry: date(220) },
    { id: 'd4', name: 'Emeka Nwosu', phone: '0752 555 0104', licenseNo: 'UG-12904-GH', licenseExpiry: date(-6) },
    { id: 'd5', name: 'Sani Lawal', phone: '0774 555 0105', licenseNo: 'UG-55018-JK', licenseExpiry: date(500) },
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
      id: `seed-${i}`,
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
      list.push({ id: `n-b-${trip.id}`, kind: 'billed', tripId: trip.id, title: `${trip.ref} invoiced`, body: `Invoice ${trip.billing.invoiceNo} sent to ${client}`, at: trip.billing.invoicedAt, read: true });
    }
    if (trip.delivery) {
      list.push({ id: `n-d-${trip.id}`, kind: 'delivered', tripId: trip.id, title: `${trip.ref} delivered`, body: `${trip.delivery.litresDelivered.toLocaleString()} L received by ${client}`, at: trip.delivery.arrivedAt, read: false });
    }
    list.push({ id: `n-s-${trip.id}`, kind: 'dispatched', tripId: trip.id, title: `${trip.ref} dispatched`, body: `${trip.litresLoaded.toLocaleString()} L ${trip.product} to ${client}, ${trip.destination}`, at: trip.dispatchedAt, read: false });
    return list;
  });
  // Seed trip GSH-0009 (index 4) is short by 360 L, above tolerance.
  notifications.push({ id: 'n-loss', kind: 'loss', tripId: trips[4].id, title: `Fuel loss on ${trips[4].ref}`, body: '360 L short, above tolerance. Needs review.', at: trips[4].delivery!.arrivedAt, read: false });
  notifications.sort((a, b) => b.at.localeCompare(a.at));

  return { trips, trucks, drivers, clients, notifications };
}
