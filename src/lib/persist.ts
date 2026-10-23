import Storage from 'expo-sqlite/kv-store';

/** Synchronous key-value persistence. The web version uses localStorage. */
export function readItem(key: string): string | null {
  return Storage.getItemSync(key);
}

export function writeItem(key: string, value: string) {
  Storage.setItemSync(key, value);
}
