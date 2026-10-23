import { useSyncExternalStore } from 'react';

import { getState, subscribe } from '@/lib/store';

export const useTrips = () => useSyncExternalStore(subscribe, () => getState().trips);
export const useTrucks = () => useSyncExternalStore(subscribe, () => getState().trucks);
export const useDrivers = () => useSyncExternalStore(subscribe, () => getState().drivers);
export const useClients = () => useSyncExternalStore(subscribe, () => getState().clients);
export const useNotifications = () => useSyncExternalStore(subscribe, () => getState().notifications);
export const useStaff = () => useSyncExternalStore(subscribe, () => getState().staff);
/** Notifications after this time are unread. */
export const useReadAt = () => useSyncExternalStore(subscribe, () => getState().notificationsReadAt);
