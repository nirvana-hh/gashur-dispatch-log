import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

import type { Role } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { syncNow } from '@/lib/sync';

export type StaffRequest =
  | { action: 'create'; email: string; password: string; fullName: string; role: Role }
  | { action: 'update'; id: string; fullName?: string; role?: Role; password?: string; active?: boolean };

/**
 * Calls the `staff-admin` edge function (supabase/functions/staff-admin), which holds the
 * secret key needed to create accounts. Unlike other changes this needs a connection:
 * it isn't queued. Returns an error message, or undefined on success.
 */
export async function manageStaff(request: StaffRequest): Promise<string | undefined> {
  if (!supabase) return 'Supabase is not configured.';
  const { error } = await supabase.functions.invoke('staff-admin', { body: request });
  if (!error) {
    // The profile change arrives through the normal pull.
    syncNow();
    return undefined;
  }
  if (error instanceof FunctionsFetchError) return "Can't reach the server. Check your connection.";
  if (error instanceof FunctionsHttpError) {
    if (error.context.status === 404) return 'The staff-admin function is not deployed yet.';
    try {
      const body = await error.context.json();
      return body.error ?? body.message ?? 'Something went wrong.';
    } catch {
      return 'Something went wrong.';
    }
  }
  return error.message;
}
