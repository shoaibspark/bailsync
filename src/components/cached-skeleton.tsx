"use client"

import Skeleton, { SkeletonTheme } from "react-loading-skeleton"

type CachedSkeletonProps = {
  isLoading: boolean
  dataLength: number
}

/**
 * Renders react-loading-skeleton placeholders only while data is loading AND
 * there is no local cached data to display. When cached data exists (or loading
 * is complete) it renders nothing so the real content shows instantly.
 */
export function CachedSkeleton({ isLoading, dataLength }: CachedSkeletonProps) {
  if (!isLoading || dataLength > 0) return null
  return (
    <SkeletonTheme baseColor="var(--muted)" highlightColor="var(--accent)">
      <div className="space-y-3">
        <Skeleton count={3} height={22} />
        <Skeleton count={4} height={16} />
      </div>
    </SkeletonTheme>
  )
}
