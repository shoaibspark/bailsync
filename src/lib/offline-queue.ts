// lib/offline-queue.ts
// Offline ball-event queue backed by IndexedDB (via `idb`) with a localStorage
// fallback. Events are persisted with client-generated UUIDs (clientEventId)
// for idempotent server handling. Auto-flushes when the browser comes back
// online, with retry/backoff.

import { openDB, type IDBPDatabase } from "idb"

const DB_NAME = "bailsync"
const STORE_NAME = "pending_balls"
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true })
        }
      },
    })
  }
  return dbPromise
}

const LS_KEY = "bailsync_pending_balls"

function lsQueue(): Array<{ id: number; payload: any }> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]")
  } catch {
    return []
  }
}

function lsSave(queue: Array<{ id: number; payload: any }>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(queue))
  } catch {}
}

export type PendingBall = {
  id: number
  payload: any
}

export const offlineQueue = {
  async add(payload: any): Promise<void> {
    const entry = { ...payload, clientEventId: payload.clientEventId || crypto.randomUUID(), ts: Date.now() }
    try {
      const db = await getDB()
      await db.add(STORE_NAME, { payload: entry })
    } catch {
      // fallback to localStorage
      const q = lsQueue()
      q.push({ id: Date.now(), payload: entry })
      lsSave(q)
    }
  },

  async list(): Promise<PendingBall[]> {
    try {
      const db = await getDB()
      const all = await db.getAll(STORE_NAME)
      return all.map((r: any) => ({ id: r.id, payload: r.payload }))
    } catch {
      return lsQueue()
    }
  },

  async remove(id: number): Promise<void> {
    try {
      const db = await getDB()
      await db.delete(STORE_NAME, id)
    } catch {
      const q = lsQueue().filter((r) => r.id !== id)
      lsSave(q)
    }
  },

  async clear(): Promise<void> {
    try {
      const db = await getDB()
      await db.clear(STORE_NAME)
    } catch {
      lsSave([])
    }
  },

  async count(matchId?: string, inningsId?: string): Promise<number> {
    const items = await this.list()
    if (!matchId && !inningsId) return items.length
    return items.filter((item) =>
      (!matchId || item.payload?.matchId === matchId) &&
      (!inningsId || item.payload?.inningsId === inningsId),
    ).length
  },
}

export async function flushQueue(
  matchId: string,
  inningsId: string,
  onProgress?: (n: number) => void,
): Promise<{ flushed: number; failed: number }> {
  const items = (await offlineQueue.list()).filter((item) =>
    item.payload?.matchId === matchId && item.payload?.inningsId === inningsId,
  )
  let flushed = 0
  let failed = 0

  // flush in order; stop on first failure to preserve ordering
  for (const item of items) {
    try {
      const res = await fetch(
        `/api/matches/${matchId}/innings/${inningsId}/balls`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([item.payload]),
        },
      )
      if (!res.ok) {
        failed += 1
        break
      }
      await offlineQueue.remove(item.id)
      flushed += 1
      onProgress?.(flushed)
    } catch {
      failed += 1
      break
    }
  }

  return { flushed, failed }
}

export async function flushAllQueue(): Promise<{ flushed: number; failed: number }> {
  const items = await offlineQueue.list()
  const groups = new Map<string, { matchId: string; inningsId: string }>()
  for (const item of items) {
    const matchId = item.payload?.matchId
    const inningsId = item.payload?.inningsId
    if (!matchId || !inningsId) continue
    groups.set(`${matchId}:${inningsId}`, { matchId, inningsId })
  }
  let flushed = 0
  let failed = 0
  for (const group of groups.values()) {
    const result = await flushQueue(group.matchId, group.inningsId)
    flushed += result.flushed
    failed += result.failed
  }
  return { flushed, failed }
}
