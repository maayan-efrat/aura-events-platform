import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * expo-secure-store has no web implementation at all (not a degraded fallback — the platform
 * just isn't in its support matrix), so calling it on web throws. This app ships react-native-web
 * and a `web` dev target, so we fall back to localStorage there. This is NOT secure storage (no
 * OS keychain on web) — fine for local dev/demo purposes, matching this app's documented "no
 * production hardening" scope, but never rely on this for a real deployment.
 */
const isWeb = Platform.OS === "web";

export async function getItemAsync(key: string): Promise<string | null> {
  if (isWeb) return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
