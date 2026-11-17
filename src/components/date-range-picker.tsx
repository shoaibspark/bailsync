"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type DateRange = {
  from: Date | undefined
  to: Date | undefined
}

const presets = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "12 months", days: 365 },
]

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = React.useState(false)

  React.useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)")
    const update = () => setIsDesktop(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  return isDesktop
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Pick a date range",
  className,
  disabled,
  align = "start",
}: {
  value: DateRange
  onChange: (range: DateRange) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  align?: "start" | "center" | "end"
}) {
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<DateRange>(value)
  const isDesktop = useIsDesktop()

  React.useEffect(() => {
    if (!open) setDraft(value)
  }, [open, value])

  const label =
    value.from && value.to
      ? `${format(value.from, "dd MMM yyyy")} – ${format(value.to, "dd MMM yyyy")}`
      : value.from
        ? `${format(value.from, "dd MMM yyyy")} – …`
        : placeholder

  const applyPreset = (days: number) => {
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - days)
    const next = { from, to }
    setDraft(next)
    onChange(next)
    setOpen(false)
  }

  const clearRange = () => {
    setDraft({ from: undefined, to: undefined })
    onChange({ from: undefined, to: undefined })
    setOpen(false)
  }

  const selectRange = (range: { from?: Date; to?: Date } | undefined) => {
    const next = { from: range?.from, to: range?.to }
    setDraft(next)
    if (isDesktop && next.from && next.to) {
      onChange(next)
      setOpen(false)
    }
  }

  const trigger = (
    <Button
      variant="outline"
      disabled={disabled}
      className={cn(
        "h-10 w-full justify-start gap-2 px-3 font-normal sm:w-auto",
        !value.from && "text-muted-foreground",
        className
      )}
    >
      <CalendarIcon data-icon="inline-start" />
      <span className="truncate">{label}</span>
    </Button>
  )

  const calendar = (
    <Calendar
      mode="range"
      numberOfMonths={1}
      selected={draft}
      onSelect={selectRange}
      className="w-full p-0"
    />
  )

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          align={align}
          sideOffset={8}
          className="w-[21rem] max-w-[calc(100vw-2rem)] p-0"
        >
          <div className="p-3">{calendar}</div>
          <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
            <div className="flex items-center gap-1">
              {presets.map((preset) => (
                <Button
                  key={preset.days}
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => applyPreset(preset.days)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={clearRange}>
                Clear
              </Button>
              <Button
                size="sm"
                disabled={!draft.from || !draft.to}
                onClick={() => {
                  onChange(draft)
                  setOpen(false)
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent className="z-[60] max-h-[92vh] border-t bg-background p-0">
        <DrawerHeader className="border-b px-4 py-3 text-left">
          <DrawerTitle className="text-base">Select date range</DrawerTitle>
          <p className="text-xs text-muted-foreground">
            Pick a start and end date, then apply.
          </p>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-2">
          <div className="flex flex-wrap gap-2 py-3">
            {presets.map((preset) => (
              <Button
                key={preset.days}
                variant="secondary"
                size="sm"
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => applyPreset(preset.days)}
              >
                Last {preset.label}
              </Button>
            ))}
          </div>
          <div className="rounded-lg border bg-card/40 px-2 py-3">{calendar}</div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button variant="ghost" onClick={clearRange}>
            Clear
          </Button>
          <Button
            disabled={!draft.from || !draft.to}
            onClick={() => {
              onChange(draft)
              setOpen(false)
            }}
          >
            Apply range
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
