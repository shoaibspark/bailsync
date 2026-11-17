"use client"

const DB_NAME = "bailsync-local"
const STORE = "resources"
const DB_VERSION = 1
const FALLBACK_PREFIX = "bailsync:cache:"

export type LocalEntry<T> = {
  data: T
  updatedAt: number
}

let dbPromise: Promise<IDBDatabase> | null = null

function supportsIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window
}

function getDb(): Promise<IDBDatabase> | null {
  if (!supportsIndexedDb()) return null
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "key" })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    }).catch((error) => {
      dbPromise = null
      throw error
    })
  }
  return dbPromise
}

function fallbackKey(key: string) {
  return `${FALLBACK_PREFIX}${key}`
}

function readFallback<T>(key: string): LocalEntry<T> | null {
  try {
    const raw = window.localStorage.getItem(fallbackKey(key))
    if (!raw) return null
    return JSON.parse(raw) as LocalEntry<T>
  } catch {
    return null
  }
}

function writeFallback(key: string, entry: LocalEntry<unknown>) {
  try {
    window.localStorage.setItem(fallbackKey(key), JSON.stringify(entry))
  } catch {
    // storage full or unavailable: ignore
  }
}

export async function readLocal<T>(key: string): Promise<LocalEntry<T> | null> {
  if (typeof window === "undefined") return null
  const db = getDb()
  if (!db) return readFallback<T>(key)
  try {
    const database = await db
    const entry = await new Promise<LocalEntry<T> | undefined>((resolve, reject) => {
      const request = database.transaction(STORE, "readonly").objectStore(STORE).get(key)
      request.onsuccess = () => resolve(request.result as LocalEntry<T> | undefined)
      request.onerror = () => reject(request.error)
    })
    return entry ?? null
  } catch {
    return readFallback<T>(key)
  }
}

export async function writeLocal<T>(key: string, data: T): Promise<LocalEntry<T>> {
  const entry: LocalEntry<T> = { data, updatedAt: Date.now() }
  if (typeof window === "undefined") return entry
  const db = getDb()
  if (!db) {
    writeFallback(key, entry as LocalEntry<unknown>)
    return entry
  }
  try {
    const database = await db
    await new Promise<void>((resolve, reject) => {
      const request = database
        .transaction(STORE, "readwrite")
        .objectStore(STORE)
        .put({ key, ...entry })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch {
    writeFallback(key, entry as LocalEntry<unknown>)
  }
  return entry
}

export async function removeLocal(key: string): Promise<void> {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(fallbackKey(key))
  } catch {
    // ignore
  }
  const db = getDb()
  if (!db) return
  try {
    const database = await db
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(STORE, "readwrite").objectStore(STORE).delete(key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch {
    // ignore
  }
}

export async function clearLocal(): Promise<void> {
  if (typeof window === "undefined") return
  try {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(FALLBACK_PREFIX))
      .forEach((key) => window.localStorage.removeItem(key))
  } catch {
    // ignore
  }
  const db = getDb()
  if (!db) return
  try {
    const database = await db
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(STORE, "readwrite").objectStore(STORE).clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch {
    // ignore
  }
}
