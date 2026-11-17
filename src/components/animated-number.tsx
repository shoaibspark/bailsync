"use client"

import { useEffect, useRef } from "react"
import { NumberFlip } from "number-flip-animation"

export function AnimatedNumber({
  value,
  className,
  formatter,
  label,
}: {
  value: number
  className?: string
  formatter?: (value: number) => string
  label?: string
}) {
  const root = useRef<HTMLSpanElement>(null)
  const flip = useRef<NumberFlip | null>(null)

  useEffect(() => {
    if (!root.current) return
    flip.current = new NumberFlip({
      rootElement: root.current,
      initialNumber: value,
      animateInitialNumber: false,
      durationSlide: 450,
      durationFade: 180,
      numberFormatter: formatter,
    })
  }, [])

  useEffect(() => {
    flip.current?.setNumber(value, true)
  }, [value, formatter])

  return (
    <span
      ref={root}
      className={className}
      role="img"
      aria-label={label ?? String(value)}
      style={{ lineHeight: 1 }}
    />
  )
}
