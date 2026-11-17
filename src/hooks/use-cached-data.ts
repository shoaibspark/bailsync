"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { readLocal, writeLocal } from "@/lib/local-cache"

export type CachedData<T> = {
  data: T | null
  updatedAt: number | null
  isLoading: boolean
  isRefreshing: boolean
  isOffline: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Cache-first data loader backed by IndexedDB (localStorage fallback).
 * Renders the last stored payload instantly, then revalidates from the API.
 */
export function useCachedData<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options?: { enabled?: boolean; revalidateOnMount?: boolean },
): CachedData<T> {
  const enabled = options?.enabled ?? true
  const revalidateOnMount = options?.revalidateOnMount ?? true
  const [data, setData] = useState<T | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(key) && enabled)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetcherRef = useRef(fetcher)

  useEffect(() => {
    fetcherRef.current = fetcher
  }, [fetcher])

  const refresh = useCallback(async () => {
    if (!key || !enabled) return
    setIsRefreshing(true)
    try {
      const payload = await fetcherRef.current()
      const entry = await writeLocal(key, payload)
      setData(payload)
      setUpdatedAt(entry.updatedAt)
      setIsOffline(false)
      setError(null)
    } catch (err: any) {
      setIsOffline(true)
      setError(err?.message ?? "Unable to refresh")
    } finally {
      setIsRefreshing(false)
      setIsLoading(false)
    }
  }, [key, enabled])

  useEffect(() => {
    if (!key || !enabled) {
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)

    readLocal<T>(key)
      .then((entry) => {
        if (cancelled || !entry) return
        setData(entry.data)
        setUpdatedAt(entry.updatedAt)
        setIsLoading(false)
      })
      .catch(() => {})

    if (revalidateOnMount) {
      refresh().catch(() => {})
    }

    return () => {
      cancelled = true
    }
  }, [key, enabled, revalidateOnMount, refresh])

  return { data, updatedAt, isLoading, isRefreshing, isOffline, error, refresh }
}
