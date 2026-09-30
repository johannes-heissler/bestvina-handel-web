/**
 * Browser storage (IndexedDB): the autosaved session, the sessions saved by name, and the gallery pictures. Every access may fail (private
 * windows, blocked storage); callers treat that as "nothing stored".
 *
 * @module
 */
const DATABASE = "bestvina-handel";
const STORE = "kv";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB is not available"));
  });
}

export async function load<T>(key: string): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error ?? new Error("read failed"));
    });
  } catch {
    return undefined;
  }
}

export async function store(key: string, value: unknown): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("write failed"));
    });
  } catch {
    // Storage is a convenience; the session itself doesn't depend on it.
  }
}

/** A session saved in the browser under a name (see {@link savedSessions}). */
export interface SavedSession<File = unknown> {
  readonly name: string;
  /** When it was saved (milliseconds since 1970). */
  readonly savedAt: number;
  readonly file: File;
}

const SAVED_KEY = "saved-sessions";

/** The sessions saved in this browser, the most recent first. */
export async function savedSessions<File>(): Promise<SavedSession<File>[]> {
  const list = (await load<SavedSession<File>[]>(SAVED_KEY)) ?? [];
  return [...list].sort((a, b) => b.savedAt - a.savedAt);
}

/** Saves a session under a name (replacing one of the same name). Resolves to false if the browser refused. */
export async function saveSession(name: string, file: unknown): Promise<boolean> {
  const list = (await load<SavedSession[]>(SAVED_KEY)) ?? [];
  const next = [...list.filter((s) => s.name !== name), { name, savedAt: Date.now(), file }];
  await store(SAVED_KEY, next);
  const check = (await load<SavedSession[]>(SAVED_KEY)) ?? [];
  return check.some((s) => s.name === name);
}

/** Deletes the saved session with this name. */
export async function deleteSession(name: string): Promise<void> {
  const list = (await load<SavedSession[]>(SAVED_KEY)) ?? [];
  await store(
    SAVED_KEY,
    list.filter((s) => s.name !== name),
  );
}
