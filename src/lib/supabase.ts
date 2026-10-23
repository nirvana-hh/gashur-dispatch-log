import 'expo-sqlite/localStorage/install';

import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Without a project URL and key (see .env.example) the app runs as a local demo:
 * no sign-in, seeded data, nothing leaves the device.
 */
export const isSupabaseConfigured = !!url && !!key;

// On native, the expo-sqlite import above provides `localStorage`, where the session is
// kept so staff stay signed in (and can work offline) between launches. On web it's the
// browser's own localStorage.
export const supabase = isSupabaseConfigured
  ? createClient(url!, key!, {
      auth: {
        storage: localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

if (supabase) {
  // Only refresh the session token while the app is in the foreground.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
