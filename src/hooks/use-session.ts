import { useSyncExternalStore } from 'react';

import { useStaff } from '@/hooks/use-store';
import { getSession, subscribeSession } from '@/lib/session';
import { getSyncStatus, subscribeSyncStatus } from '@/lib/sync';

export const useSession = () => useSyncExternalStore(subscribeSession, getSession);
export const useSyncStatus = () => useSyncExternalStore(subscribeSyncStatus, getSyncStatus);

/** The signed-in person's staff record, once profiles have synced. */
export function useMe() {
  const session = useSession();
  const staff = useStaff();
  return session.status === 'signedIn' ? staff.find((s) => s.id === session.userId) : undefined;
}

/**
 * Whether this person may delete records and clear loss flags. The database enforces the
 * same rule; this only hides buttons that would be refused. The local demo allows it.
 */
export function useCanManage() {
  const session = useSession();
  const me = useMe();
  return session.status === 'local' || (me?.role === 'manager' && me.active);
}

/** "Musa A." style name for a staff id, for showing who made a record. */
export function useStaffName() {
  const staff = useStaff();
  return (id: string | undefined) => {
    if (!id) return undefined;
    const person = staff.find((s) => s.id === id);
    return person?.name || person?.email || undefined;
  };
}
