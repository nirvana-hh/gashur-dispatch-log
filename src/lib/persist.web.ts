// expo-sqlite on web needs WebAssembly and cross-origin isolation headers; localStorage is enough here.
export function readItem(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeItem(key: string, value: string) {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode, static rendering); the app still runs in memory.
  }
}

export function removeItem(key: string) {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // See writeItem.
  }
}
