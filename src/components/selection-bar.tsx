"use client"

import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SelectionBar({
  count,
  onClear,
  actions,
}: {
  count: number
  onClear: () => void
  actions?: React.ReactNode
}) {
  if (count === 0) return null
  return (
    <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 border-t bg-background/95 px-3 py-2 shadow-[0_-8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-lg items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {count}
        </span>
        <span className="truncate text-sm font-medium">selected</span>
        <div className="ml-auto flex items-center gap-1.5">
          {actions}
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        </div>
      </div>
    </div>
  )
}

export function SelectionCheck({ checked }: { checked: boolean }) {
  return (
    <span
      className={`flex size-6 items-center justify-center rounded-full border-2 ${checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50 bg-background/80"}`}
      aria-hidden="true"
    >
      {checked && <Check className="size-4" />}
    </span>
  )
}
