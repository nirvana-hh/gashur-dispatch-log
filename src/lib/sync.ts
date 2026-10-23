import type { PostgrestError } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { readItem, removeItem, writeItem } from '@/lib/persist';
import {
  clientFromRow,
  driverFromRow,
  notificationFromRow,
  staffFromRow,
  tripFromRow,
  truckFromRow,
  type Row,
  type Table,
} from '@/lib/rows';
import { applyReadTime, applyRemote, onLocalChanges, type Op, type State } from '@/lib/store';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * Keeps the local cache and Supabase in step.
 *
 * Push: every local change is queued in a persisted outbox and sent in order, so edits
 * made offline (or while a request is in flight) survive restarts and reach the server
 * once it can be reached. A change the server refuses (e.g. a dispatcher deleting a
 * trip) is dropped, and that record is re-fetched so the device shows the truth again.
 *
 * Pull: each table is read by `updated_at` since the last pull, so only changes travel.
 * Realtime events, coming back to the app, and a slow timer all trigger a pull.
 */

const OUTBOX_KEY = 'gashur:outbox:v1';
const CURSOR_KEY = 'gashur:cursors:v1';
const PAGE = 1000;
// Rows committed in the same instant as the last pull can arrive slightly late; re-read
// a few seconds back each time. Re-applying a row is harmless.
const OVERLAP_MS = 5_000;
const POLL_MS = 60_000;

type Slice = Exclude<keyof State, 'notificationsReadAt'>;

const Tables: { table: Table; slice: Slice; fromRow: (row: Row) => State[Slice][number]; softDelete: boolean }[] = [
  { table: 'profiles', slice: 'staff', fromRow: staffFromRow, softDelete: false },
  { table: 'clients', slice: 'clients', fromRow: clientFromRow, softDelete: true },
  { table: 'trucks', slice: 'trucks', fromRow: truckFromRow, softDelete: true },
  { table: 'drivers', slice: 'drivers', fromRow: driverFromRow, softDelete: true },
  { table: 'trips', slice: 'trips', fromRow: tripFromRow, softDelete: true },
  { table: 'notifications', slice: 'notifications', fromRow: notificationFromRow, softDelete: true },
];

export type SyncStatus = {
  phase: 'off' | 'syncing' | 'synced' | 'offline';
  /** Local changes not yet accepted by the server. */
  pending: number;
  lastSyncedAt?: string;
  /** The most recent change the server refused, shown to the user. */
  rejected?: string;
};

let outbox: Op[] = readJson<Op[]>(OUTBOX_KEY) ?? [];
let cursors: Partial<Record<Table, string>> = readJson(CURSOR_KEY) ?? {};
let status: SyncStatus = { phase: 'off', pending: outbox.length };
const statusListeners = new Set<() => void>();

let userId: string | undefined;
let running = false;
let again = false;
let retryMs = 5_000;
let timer: ReturnType<typeof setTimeout> | undefined;
let poll: ReturnType<typeof setInterval> | undefined;
let channel: ReturnType<NonNullable<typeof supabase>['channel']> | undefined;
let appState: { remove: () => void } | undefined;

if (isSupabaseConfigured) {
  onLocalChanges((ops) => {
    outbox = [...outbox, ...ops];
    saveOutbox();
    schedule(300);
  });
}

export function getSyncStatus() {
  return status;
}

export function subscribeSyncStatus(listener: () => void) {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

/** Begins syncing for a signed-in user. */
export function startSync(id: string) {
  if (!supabase) return;
  stopSync();
  userId = id;
  setStatus({ phase: 'syncing' });
  channel = supabase
    .channel('company-data')
    .on('postgres_changes', { event: '*', schema: 'public' }, () => schedule(500))
    .subscribe();
  appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') schedule(0);
  });
  poll = setInterval(() => schedule(0), POLL_MS);
  schedule(0);
}

export function stopSync() {
  userId = undefined;
  if (timer) clearTimeout(timer);
  if (poll) clearInterval(poll);
  appState?.remove();
  if (channel) supabase?.removeChannel(channel);
  timer = poll = channel = appState = undefined;
  setStatus({ phase: 'off' });
}

/** Forgets queued changes and pull positions, for signing out. */
export function clearSyncData() {
  outbox = [];
  cursors = {};
  removeItem(OUTBOX_KEY);
  removeItem(CURSOR_KEY);
  setStatus({ pending: 0, lastSyncedAt: undefined, rejected: undefined });
}

export function syncNow() {
  schedule(0);
}

function schedule(delayMs: number) {
  if (!userId) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(run, delayMs);
}

async function run() {
  timer = undefined;
  if (!supabase || !userId) return;
  if (running) {
    again = true;
    return;
  }
  running = true;
  setStatus({ phase: 'syncing' });
  try {
    await push();
    await pull();
    retryMs = 5_000;
    setStatus({ phase: 'synced', lastSyncedAt: new Date().toISOString() });
  } catch {
    // Network trouble or an expired session: keep everything queued and try again later.
    setStatus({ phase: 'offline' });
    schedule(retryMs);
    retryMs = Math.min(retryMs * 2, 60_000);
  } finally {
    running = false;
    if (again) {
      again = false;
      schedule(0);
    }
  }
}

async function push() {
  while (outbox.length > 0 && supabase && userId) {
    const op = outbox[0];
    const { error } =
      op.kind === 'insert'
        ? await supabase.from(op.table).upsert({ ...op.values, id: op.id }, { onConflict: 'id' })
        : await supabase.from(op.table).update(op.values).eq('id', op.id);
    if (error && isTransient(error)) throw error;
    outbox = outbox.slice(1);
    saveOutbox();
    if (error) {
      setStatus({ rejected: error.message });
      await refetch(op);
    }
  }
}

async function pull() {
  for (const { table, slice, fromRow, softDelete } of Tables) {
    let since = cursors[table];
    let first = true;
    for (;;) {
      let query = supabase!.from(table).select('*').order('updated_at').limit(PAGE);
      if (since) {
        const from = first ? new Date(Date.parse(since) - OVERLAP_MS).toISOString() : since;
        query = query.gt('updated_at', from);
      }
      const { data, error } = await query;
      if (error) throw error;
      const pending = new Set(outbox.filter((op) => op.table === table).map((op) => op.id));
      applyRemote(
        slice,
        data.map((row) => ({ item: fromRow(row), deleted: softDelete && row.deleted_at != null })),
        pending,
      );
      if (table === 'profiles') {
        const me = data.find((row) => row.id === userId);
        if (me) applyReadTime(staffFromRow(me).notificationsReadAt);
      }
      if (data.length > 0) {
        since = data[data.length - 1].updated_at as string;
        cursors = { ...cursors, [table]: since };
        writeItem(CURSOR_KEY, JSON.stringify(cursors));
      }
      first = false;
      if (data.length < PAGE) break;
    }
  }
}

/** After a refused change, reload that record so the device matches the server. */
async function refetch(op: Op) {
  const entry = Tables.find((t) => t.table === op.table)!;
  const { data, error } = await supabase!.from(op.table).select('*').eq('id', op.id).maybeSingle();
  if (error) throw error;
  const pending = new Set(outbox.filter((o) => o.table === op.table).map((o) => o.id));
  if (data) {
    applyRemote(entry.slice, [{ item: entry.fromRow(data), deleted: entry.softDelete && data.deleted_at != null }], pending);
  } else if (op.kind === 'insert') {
    // The server never accepted it, so it shouldn't stay on the device either.
    applyRemote(entry.slice, [{ item: { id: op.id } as State[Slice][number], deleted: true }], pending);
  }
}

/** No code means the request never got an answer; PGRST3xx are expired or missing sessions. */
function isTransient(error: PostgrestError) {
  return !error.code || error.code.startsWith('PGRST3');
}

function saveOutbox() {
  writeItem(OUTBOX_KEY, JSON.stringify(outbox));
  setStatus({ pending: outbox.length });
}

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  statusListeners.forEach((listener) => listener());
}

function readJson<T>(key: string): T | undefined {
  const raw = readItem(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}
