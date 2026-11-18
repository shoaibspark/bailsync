"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { decodeSseFrame } from "@/lib/wire-codec"
import type { MatchState } from "@/lib/cricket-engine/types"

export type UseMatchStreamResult = {
  state: MatchState | null
  connected: boolean
  connecting: boolean
  lastUpdated: number | null
  reconnecting: boolean
}

export function useMatchStream(matchId: string): UseMatchStreamResult {
  const [state, setState] = useState<MatchState | null>(null)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [reconnecting, setReconnecting] = useState(false)

  const eventSource = useRef<EventSource | null>(null)
  const reconnectTimeout = useRef<number | null>(null)
  const reconnectAttempt = useRef(0)
  const connectRef = useRef<(() => void) | null>(null)

  const connect = useCallback(() => {
    setConnecting(true)
    setConnected(false)
    eventSource.current?.close()
    const source = new EventSource(`/api/matches/${matchId}/stream`)
    eventSource.current = source

    const receive = (event: MessageEvent) => {
      if (!event.data || event.data.startsWith(":")) return
      try {
        const frame = decodeSseFrame(`data: ${event.data}\n\n`)
        if (frame.data) {
          setState(frame.data as MatchState)
          setLastUpdated(Date.now())
        }
      } catch {}
    }

    source.onopen = () => {
      setConnected(true)
      setConnecting(false)
      setReconnecting(false)
      reconnectAttempt.current = 0
    }
    source.onmessage = receive
    source.addEventListener("snapshot", receive as EventListener)
    source.addEventListener("state", receive as EventListener)
    source.onerror = () => {
      setConnected(false)
      setConnecting(false)
      source.close()
      if (reconnectTimeout.current) return
      setReconnecting(true)
      const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 15000)
      reconnectAttempt.current += 1
      reconnectTimeout.current = window.setTimeout(() => {
        reconnectTimeout.current = null
        connectRef.current?.()
      }, delay)
    }
  }, [matchId])

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  useEffect(() => {
    setState(null)
    connect()
    return () => {
      if (reconnectTimeout.current) {
        window.clearTimeout(reconnectTimeout.current)
        reconnectTimeout.current = null
      }
      eventSource.current?.close()
    }
  }, [connect])

  return { state, connected, connecting, lastUpdated, reconnecting }
}
