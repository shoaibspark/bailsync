"use client"

import * as React from "react"
import { ChevronsUpDownIcon } from "lucide-react"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ComboboxOption = {
  value: string
  label: string
}

export function MultiSelectCombobox({
  options,
  value,
  onChange,
  placeholder = "Select options",
  emptyLabel = "No options found.",
  disabled,
  className,
  id,
}: {
  options: ComboboxOption[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  emptyLabel?: string
  disabled?: boolean
  className?: string
  id?: string
}) {
  const anchor = useComboboxAnchor()
  const items = React.useMemo(() => options.map((option) => option.value), [options])
  const labelFor = React.useCallback(
    (item: string) => options.find((option) => option.value === item)?.label ?? item,
    [options],
  )

  return (
    <Combobox
      multiple
      autoHighlight
      items={items}
      value={value}
      onValueChange={(next) => onChange(next as string[])}
      disabled={disabled}
    >
      <ComboboxChips ref={anchor} className={cn("w-full", className)}>
        <ComboboxValue>
          {(selected: string[]) => (
            <React.Fragment>
              {selected.map((item) => (
                <ComboboxChip key={item}>{labelFor(item)}</ComboboxChip>
              ))}
              <ComboboxChipsInput id={id} placeholder={selected.length ? "" : placeholder} />
            </React.Fragment>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor} className="w-[var(--anchor-width)]">
        <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              <span className="flex-1 truncate">{labelFor(item)}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

export function MultiSelectTrigger({
  options,
  value,
  onChange,
  placeholder = "Select options",
  disabled,
  className,
}: {
  options: ComboboxOption[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const items = React.useMemo(() => options.map((option) => option.value), [options])
  const labels = value
    .map((item) => options.find((option) => option.value === item)?.label ?? item)
    .filter(Boolean)

  return (
    <Combobox
      multiple
      autoHighlight
      open={open}
      onOpenChange={setOpen}
      items={items}
      value={value}
      onValueChange={(next) => onChange(next as string[])}
      disabled={disabled}
    >
      <ComboboxTrigger
        render={<Button variant="outline" role="combobox" aria-expanded={open} className={cn("w-full justify-between font-normal", className)} />}
      >
        <span className={cn("truncate", !labels.length && "text-muted-foreground")}>
          {labels.length ? labels.join(", ") : placeholder}
        </span>
        <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxEmpty>No options found.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              <span className="flex-1 truncate">
                {options.find((option) => option.value === item)?.label ?? item}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
