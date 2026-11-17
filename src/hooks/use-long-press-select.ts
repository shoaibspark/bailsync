"use client"

import { useCallback, useRef } from "react"

export type LongPressHandlers = {
  onTouchStart: () => void
  onTouchEnd: () => void
  onTouchMove: () => void
  onTouchCancel: () => void
  onContextMenu: (event: React.MouseEvent) => void
}

/**
 * Long-press gesture helper for mobile lists: hold an entry to enter selection
 * mode, then tap other entries to toggle them.
 */
export function useLongPressSelect({
  onLongPress,
  delay = 450,
}: {
  onLongPress: (id: string) => void
  delay?: number
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchActive = useRef(false)

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const start = useCallback(
    (id: string) => {
      touchActive.current = true
      clear()
      timer.current = setTimeout(() => onLongPress(id), delay)
    },
    [clear, delay, onLongPress],
  )

  const handlers = useCallback(
    (id: string): LongPressHandlers => ({
      onTouchStart: () => start(id),
      onTouchEnd: clear,
      onTouchMove: clear,
      onTouchCancel: clear,
      onContextMenu: (event: React.MouseEvent) => {
        if (touchActive.current) event.preventDefault()
      },
    }),
    [clear, start],
  )

  return { handlers, clear }
}
