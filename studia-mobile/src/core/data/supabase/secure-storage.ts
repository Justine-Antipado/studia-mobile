// secure-storage.ts: Supabase session storage on top of expo-secure-store (Keychain / Keystore).
// A Supabase session is bigger than SecureStore's ~2 KB per-value limit, so it is split into chunks.
// Never use AsyncStorage for tokens.
import * as SecureStore from "expo-secure-store";

const CHUNK = 1800;
const safeKey = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, "_");
const countKey = (k: string) => `${safeKey(k)}.n`;
const chunkKey = (k: string, i: number) => `${safeKey(k)}.${i}`;

async function removeChunks(key: string): Promise<void> {
  const n = Number((await SecureStore.getItemAsync(countKey(key))) ?? "0");
  for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(chunkKey(key, i));
  await SecureStore.deleteItemAsync(countKey(key));
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const n = Number((await SecureStore.getItemAsync(countKey(key))) ?? "0");
      if (!n) return null;
      const parts: string[] = [];
      for (let i = 0; i < n; i++) {
        const part = await SecureStore.getItemAsync(chunkKey(key, i));
        if (part === null) return null; // torn write: treat as signed out rather than crash
        parts.push(part);
      }
      return parts.join("");
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    await removeChunks(key);
    const n = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < n; i++) {
      await SecureStore.setItemAsync(chunkKey(key, i), value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
    await SecureStore.setItemAsync(countKey(key), String(n));
  },
  async removeItem(key: string): Promise<void> {
    try {
      await removeChunks(key);
    } catch {
      /* nothing stored */
    }
  },
};
