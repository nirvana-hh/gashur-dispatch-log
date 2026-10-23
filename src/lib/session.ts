import type { Session } from '@supabase/supabase-js';

import { readItem, writeItem } from '@/lib/persist';
import { resetCache, setActor } from '@/lib/store';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { clearSyncData, startSync, stopSync } from '@/lib/sync';

/**
 * Who is using the app. `local` is the demo mode without Supabase, where the single
 * device user can do everything. Roles come from the `staff` slice (Supabase profiles).
 */
export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; userId: string; email: string }
  | { status: 'local' };

// The last account whose data is in the cache, so a different person signing in on
// this device never sees it.
const LAST_USER_KEY = 'gashur:last-user';

let session: SessionState = isSupabaseConfigured ? { status: 'loading' } : { status: 'local' };
const listeners = new Set<() => void>();

export function getSession() {
  return session;
}

export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function set(next: SessionState) {
  session = next;
  listeners.forEach((listener) => listener());
}

// While a password reset is finishing, the code has already signed the person in, but the
// app shouldn't open until their new password is saved. Hold the session until then.
let resetting = false;
let heldSession: Session | null | undefined;

function apply(auth: Session | null) {
  if (resetting) {
    heldSession = auth;
    return;
  }
  if (!auth) {
    setActor(undefined);
    stopSync();
    set({ status: 'signedOut' });
    return;
  }
  const { id, email = '' } = auth.user;
  if (session.status === 'signedIn' && session.userId === id) return;
  if (readItem(LAST_USER_KEY) !== id) {
    resetCache();
    clearSyncData();
    writeItem(LAST_USER_KEY, id);
  }
  setActor(id);
  set({ status: 'signedIn', userId: id, email });
  startSync(id);
}

if (supabase) {
  // The stored session is read from the device, so this resolves without the network
  // and a signed-in user sees their cached data straight away, even offline.
  supabase.auth.getSession().then(({ data }) => apply(data.session));
  // Supabase warns against awaiting its own calls inside this callback; defer the work.
  supabase.auth.onAuthStateChange((_event, auth) => {
    setTimeout(() => apply(auth), 0);
  });
}

export async function signIn(email: string, password: string): Promise<string | undefined> {
  if (!supabase) return 'Supabase is not configured.';
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  return error ? friendly(error.message) : undefined;
}

/** Emails a one-time code for resetting the password (see README: the email template shows it). */
export async function sendResetCode(email: string): Promise<string | undefined> {
  if (!supabase) return 'Supabase is not configured.';
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
  return error ? friendly(error.message) : undefined;
}

/** Checks the emailed code, saves the new password, then lets the app open. */
export async function resetWithCode(email: string, code: string, password: string): Promise<string | undefined> {
  if (!supabase) return 'Supabase is not configured.';
  resetting = true;
  heldSession = undefined;
  try {
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'recovery' });
    if (error) return friendly(error.message);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      // Don't leave them signed in with a password they didn't choose.
      await supabase.auth.signOut({ scope: 'local' });
      return friendly(updateError.message);
    }
    return undefined;
  } finally {
    resetting = false;
    if (heldSession !== undefined) apply(heldSession);
    heldSession = undefined;
  }
}

/** For a signed-in person: confirms the current password, then sets the new one. */
export async function changePassword(current: string, next: string): Promise<string | undefined> {
  if (!supabase || session.status !== 'signedIn') return 'Not signed in.';
  const check = await supabase.auth.signInWithPassword({ email: session.email, password: current });
  if (check.error) {
    return check.error.message.toLowerCase().includes('invalid login') ? 'Your current password is wrong.' : friendly(check.error.message);
  }
  const { error } = await supabase.auth.updateUser({ password: next });
  return error ? friendly(error.message) : undefined;
}

function friendly(message: string) {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'Wrong email or password.';
  if (m.includes('fetch') || m.includes('network')) return "Can't reach the server. Check your connection.";
  if (m.includes('expired') || (m.includes('invalid') && m.includes('token'))) return 'That code is wrong or has expired. Ask for a new one.';
  if (m.includes('rate limit') || m.includes('security purposes')) return 'Too many attempts. Wait a minute and try again.';
  if (m.includes('should be different')) return 'Choose a password different from your old one.';
  if (m.includes('password should be')) return 'That password is too weak. Use at least 8 characters.';
  return message;
}

/** Signs out and wipes this device's copy of the company data. */
export async function signOut() {
  if (!supabase) return;
  stopSync();
  await supabase.auth.signOut({ scope: 'local' });
  resetCache();
  clearSyncData();
  writeItem(LAST_USER_KEY, '');
}

