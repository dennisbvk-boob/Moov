/**
 * Attachments live here first and in Supabase Storage second.
 *
 * You photograph the meter cupboard in an empty house with no signal; the file
 * goes into IndexedDB straight away and uploads when there's a connection.
 * localStorage is no use for this — a single phone photo would blow the quota.
 */

const DB_NAME = 'moov-blobs';
const STORE = 'files';

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function putBlob(id: string, blob: Blob): Promise<void> {
  await tx('readwrite', (s) => s.put(blob, id));
}

export async function getBlob(id: string): Promise<Blob | null> {
  try {
    const v = await tx<Blob | undefined>('readonly', (s) => s.get(id));
    return v ?? null;
  } catch {
    return null;
  }
}

export async function deleteBlob(id: string): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(id));
  } catch {
    /* already gone — nothing to clean up */
  }
}

/** Drop every locally-cached file (used when detaching a device from a plan). */
export async function clearBlobs(): Promise<void> {
  try {
    await tx('readwrite', (s) => s.clear());
  } catch {
    /* nothing to clear */
  }
}
