// lib/realtime/sse-hub.ts
// In-memory pub/sub hub backed by Node.js EventEmitter, cached on globalThis
// so Next.js dev hot-reload doesn't create duplicates.
// Single-instance limitation: works for one server process. Documented in README.

import { EventEmitter } from "events"

type Listener = (state: unknown) => void

const hubKey = "__bailsync_sse_hub__"

const getHub = (): { emitter: EventEmitter; lastState: Map<string, unknown> } => {
  const g = globalThis as unknown as { [hubKey]?: ReturnType<typeof getHub> }
  if (!g[hubKey]) {
    g[hubKey] = {
      emitter: new EventEmitter(),
      lastState: new Map(),
    }
    g[hubKey].emitter.setMaxListeners(1000)
  }
  return g[hubKey]!
}

export const sseHub = {
  subscribe(matchId: string, listener: Listener): () => void {
    const hub = getHub()
    const event = `match:${matchId}`
    hub.emitter.on(event, listener)
    // send last cached state immediately
    const cached = hub.lastState.get(matchId)
    if (cached !== undefined) {
      listener(cached)
    }
    return () => {
      hub.emitter.off(event, listener)
    }
  },

  publish(matchId: string, state: unknown): void {
    const hub = getHub()
    hub.lastState.set(matchId, state)
    hub.emitter.emit(`match:${matchId}`, state)
  },

  listenerCount(matchId: string): number {
    return getHub().emitter.listenerCount(`match:${matchId}`)
  },
}

export type { Listener }
