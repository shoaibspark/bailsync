"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import toast from "react-hot-toast"
import { format } from "date-fns"
import { ArrowRight, LoaderCircle, Pencil, Plus, Save, Search, Trash2, UserRound, UsersRound, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { DateRangePicker, type DateRange } from "@/components/date-range-picker"
import { SelectionBar, SelectionCheck } from "@/components/selection-bar"
import { TablePagination } from "@/components/table-pagination"
import { apiJson } from "@/lib/api-client"
import { useCachedData } from "@/hooks/use-cached-data"
import { useLongPressSelect } from "@/hooks/use-long-press-select"
import { useSession } from "@/hooks/use-session"
import { isManager, isSuperadmin } from "@/lib/roles"
import { cn } from "@/lib/utils"

const schema = z.object({
  clubId: z.string().min(1, "Select a club"),
  name: z.string().min(2, "Enter the player name"),
  jerseyNumber: z.number().int().min(0).max(99).optional(),
  role: z.enum(["BATTER", "BOWLER", "ALL_ROUNDER", "WICKET_KEEPER"]),
})

type Club = { id: string; name: string }
type Player = { id: string; clubId: string; name: string; jerseyNumber: number | null; role: string; club?: Club }
type RangeStat = { playerId: string; runs: number; balls: number; wickets: number; runsConceded: number; ballsBowled: number }

export default function PlayersPage() {
  const [open, setOpen] = useState(false)
  const [clubFilter, setClubFilter] = useState("ALL")
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState<Player | null>(null)
  const [editValues, setEditValues] = useState({ name: "", jerseyNumber: "", role: "BATTER" })
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [range, setRange] = useState<DateRange>({ from: undefined, to: undefined })
  const [selectionMode, setSelectionMode] = useState(false)
  const [rangeStats, setRangeStats] = useState<Record<string, RangeStat>>({})
  const { session, status } = useSession()
  const sessionLoading = status === "loading"
  const canManage = isManager(session?.role)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { clubId: "", name: "", jerseyNumber: undefined, role: "BATTER" },
  })

  const clubsCache = useCachedData<Club[]>("clubs:list", () => apiJson<Club[]>("/api/clubs"))
  const playersCache = useCachedData<Player[]>("players:list", () => apiJson<Player[]>("/api/players"))
  const clubs = clubsCache.data ?? []
  const players = playersCache.data ?? []
  const loading = (clubsCache.isLoading || playersCache.isLoading) && !clubs.length && !players.length

  const manageableClubs = isSuperadmin(session?.role)
    ? clubs
    : clubs.filter((club) => session?.clubIds.includes(club.id))
  const canEditPlayer = (player: Player) =>
    isSuperadmin(session?.role) || (session?.role === "ADMIN" && session.clubIds.includes(player.clubId))

  useEffect(() => {
    if (!clubs.length) return
    const fallback = manageableClubs[0] ?? clubs[0]
    if (fallback && !form.getValues("clubId")) {
      form.setValue("clubId", fallback.id)
    }
  }, [clubs, manageableClubs, form])

  useEffect(() => {
    if (!range.from && !range.to) {
      setRangeStats({})
      return
    }
    let active = true
    const params = new URLSearchParams()
    if (range.from) params.set("from", range.from.toISOString())
    if (range.to) params.set("to", range.to.toISOString())
    apiJson<{ stats: RangeStat[] }>(`/api/players/stats?${params.toString()}`)
      .then((payload) => {
        if (!active) return
        const map: Record<string, RangeStat> = {}
        payload.stats.forEach((entry) => {
          map[entry.playerId] = entry
        })
        setRangeStats(map)
      })
      .catch(() => {
        if (active) setRangeStats({})
      })
    return () => {
      active = false
    }
  }, [range])

  const visiblePlayers = useMemo(() => {
    const term = query.trim().toLowerCase()
    return players
      .filter((player) => clubFilter === "ALL" || player.clubId === clubFilter)
      .filter((player) =>
        !term
          ? true
          : [player.name, player.jerseyNumber, player.role, player.club?.name]
              .filter((field) => field !== null && field !== undefined)
              .some((field) => String(field).toLowerCase().includes(term)),
      )
  }, [clubFilter, players, query])

  const pageCount = Math.max(1, Math.ceil(visiblePlayers.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pagePlayers = visiblePlayers.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const selectableIds = pagePlayers.filter((player) => canEditPlayer(player)).map((player) => player.id)
  const allVisibleSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.includes(id))

  const toggleAll = () => {
    setSelected((current) =>
      allVisibleSelected
        ? current.filter((id) => !selectableIds.includes(id))
        : Array.from(new Set([...current, ...selectableIds])),
    )
  }

  const toggleOne = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  const { handlers: longPressHandlers } = useLongPressSelect({
    onLongPress: (id) => {
      setSelectionMode(true)
      setSelected((current) => (current.includes(id) ? current : [...current, id]))
    },
  })

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setSubmitting(true)
    try {
      await apiJson<Player>("/api/players", {
        method: "POST",
        body: {
          clubId: values.clubId,
          name: values.name,
          jerseyNumber: values.jerseyNumber,
          role: values.role,
        },
      })
      toast.success("Player added")
      form.reset()
      setOpen(false)
      await playersCache.refresh()
    } catch (cause: any) {
      toast.error(cause.message ?? "Unable to add the player")
    } finally {
      setSubmitting(false)
    }
  }

  const startEditing = (player: Player) => {
    setEditing(player)
    setEditValues({
      name: player.name,
      jerseyNumber: player.jerseyNumber === null ? "" : String(player.jerseyNumber),
      role: player.role,
    })
  }

  const saveEditing = async () => {
    if (!editing) return
    setSavingEdit(true)
    try {
      await apiJson<Player>(`/api/players/${editing.id}`, {
        method: "PATCH",
        body: {
          name: editValues.name,
          jerseyNumber: editValues.jerseyNumber === "" ? null : Number(editValues.jerseyNumber),
          role: editValues.role,
        },
      })
      toast.success("Player updated")
      setEditing(null)
      await playersCache.refresh()
    } catch (cause: any) {
      toast.error(cause.message ?? "Unable to update the player")
    } finally {
      setSavingEdit(false)
    }
  }

  const deletePlayer = async (player: Player) => {
    if (!window.confirm(`Delete ${player.name} from ${clubName(player.clubId)}?`)) return
    setDeletingId(player.id)
    try {
      await apiJson(`/api/players/${player.id}`, { method: "DELETE" })
      toast.success("Player deleted")
      setSelected((current) => current.filter((id) => id !== player.id))
      if (editing?.id === player.id) setEditing(null)
      await playersCache.refresh()
    } catch (cause: any) {
      toast.error(cause.message ?? "Unable to delete the player")
    } finally {
      setDeletingId("")
    }
  }

  const bulkDelete = async () => {
    if (!selected.length) return
    if (!window.confirm(`Delete ${selected.length} player${selected.length === 1 ? "" : "s"}? Squad entries will also be removed.`)) return
    setBulkDeleting(true)
    try {
      for (const id of selected) {
        await apiJson(`/api/players/${id}`, { method: "DELETE" })
      }
      toast.success("Players deleted")
      setSelected([])
      await playersCache.refresh()
    } catch (cause: any) {
      toast.error(cause.message ?? "Unable to delete the selected players")
    } finally {
      setBulkDeleting(false)
    }
  }

  const clubName = (clubId: string) => clubs.find((club) => club.id === clubId)?.name ?? "Unknown club"
  const rangeActive = Boolean(range.from || range.to)

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary sm:text-xs"><UsersRound className="size-4" /> Player registry</div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight sm:text-3xl">Players</h1>
            {status !== "loading" && !canManage && <Badge variant="outline">View only</Badge>}
          </div>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm sm:text-base">Manage club rosters, compare form over a date range, and keep player profiles ready for match selection.</p>
        </div>
        <Button onClick={() => setOpen((current) => !current)} disabled={!canManage} className="h-8 w-full text-xs sm:h-9 sm:w-auto sm:text-sm">{open ? <X /> : <Plus />}{open ? "Close" : "Add player"}</Button>
      </div>

      {open && canManage && (
        <Card className="mb-6 border-primary/20 bg-primary/[0.03]">
          <CardHeader><CardTitle>Register a player</CardTitle><CardDescription>Add a player to a club roster. Jersey numbers must be unique within that club.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5 lg:grid-cols-[1fr_1.2fr_0.7fr_1fr_auto] lg:items-end">
              <div className="flex flex-col gap-2"><Label>Club</Label><Controller control={form.control} name="clubId" render={({ field }) => <Select value={field.value} onValueChange={field.onChange}><SelectTrigger className="w-full"><SelectValue placeholder="Select club" /></SelectTrigger><SelectContent><SelectGroup>{manageableClubs.map((club) => <SelectItem key={club.id} value={club.id}>{club.name}</SelectItem>)}</SelectGroup></SelectContent></Select>} />{form.formState.errors.clubId && <p className="text-sm text-destructive">{form.formState.errors.clubId.message}</p>}</div>
              <div className="flex flex-col gap-2"><Label htmlFor="player-name">Player name</Label><Input id="player-name" placeholder="J. Taylor" aria-invalid={Boolean(form.formState.errors.name)} {...form.register("name")} />{form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}</div>
              <div className="flex flex-col gap-2"><Label htmlFor="jersey-number">Jersey no.</Label><Input id="jersey-number" type="number" min={0} max={99} aria-invalid={Boolean(form.formState.errors.jerseyNumber)} {...form.register("jerseyNumber", { valueAsNumber: true })} />{form.formState.errors.jerseyNumber && <p className="text-sm text-destructive">{form.formState.errors.jerseyNumber.message}</p>}</div>
              <div className="flex flex-col gap-2"><Label>Role</Label><Controller control={form.control} name="role" render={({ field }) => <Select value={field.value} onValueChange={field.onChange}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="BATTER">Batter</SelectItem><SelectItem value="BOWLER">Bowler</SelectItem><SelectItem value="ALL_ROUNDER">All-rounder</SelectItem><SelectItem value="WICKET_KEEPER">Wicketkeeper</SelectItem></SelectGroup></SelectContent></Select>} /></div>
              <Button type="submit" disabled={submitting}>{submitting && <LoaderCircle className="animate-spin" />}Add player</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {editing && (
        <Card className="mb-6 border-primary/30 bg-primary/[0.03]">
          <CardHeader>
            <CardTitle>Edit {editing.name}</CardTitle>
            <CardDescription>Update the player profile for {clubName(editing.clubId)}.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.7fr_1fr_auto] lg:items-end">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-player-name">Player name</Label>
                <Input id="edit-player-name" value={editValues.name} onChange={(event) => setEditValues((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-jersey-number">Jersey no.</Label>
                <Input id="edit-jersey-number" type="number" min={0} max={99} value={editValues.jerseyNumber} onChange={(event) => setEditValues((current) => ({ ...current, jerseyNumber: event.target.value }))} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-player-role">Role</Label>
                <Select value={editValues.role} onValueChange={(value) => setEditValues((current) => ({ ...current, role: value }))}>
                  <SelectTrigger id="edit-player-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="BATTER">Batter</SelectItem>
                      <SelectItem value="BOWLER">Bowler</SelectItem>
                      <SelectItem value="ALL_ROUNDER">All-rounder</SelectItem>
                      <SelectItem value="WICKET_KEEPER">Wicketkeeper</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={saveEditing} disabled={savingEdit || editValues.name.trim().length < 2}>
                  {savingEdit ? <LoaderCircle className="animate-spin" /> : <Save />}
                  Save changes
                </Button>
                <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
          <button type="button" onClick={() => setClubFilter("ALL")} className={`h-7 shrink-0 rounded-full border px-2.5 text-[11px] font-semibold sm:h-8 sm:px-3 sm:text-xs ${clubFilter === "ALL" ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>All clubs</button>
          {clubs.map((club) => <button key={club.id} type="button" onClick={() => setClubFilter(club.id)} className={`h-7 shrink-0 rounded-full border px-2.5 text-[11px] font-semibold sm:h-8 sm:px-3 sm:text-xs ${clubFilter === club.id ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>{club.name}</button>)}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
              placeholder="Search players"
              className="h-8 pl-8 text-xs sm:h-9 sm:pl-9 sm:text-sm"
              aria-label="Search players"
            />
          </div>
          <DateRangePicker value={range} onChange={(next) => { setRange(next); setPage(1) }} className="sm:w-64" />
        </div>
      </div>

      {rangeActive && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium">Stats window</span>
          <span className="text-muted-foreground">
            {range.from ? format(range.from, "dd MMM yyyy") : "Start"} → {range.to ? format(range.to, "dd MMM yyyy") : "Today"}
          </span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setRange({ from: undefined, to: undefined })}>Clear range</Button>
        </div>
      )}

      {selected.length > 0 && (
        <div className="mb-4 hidden flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 lg:flex">
          <span className="text-sm font-medium">{selected.length} selected</span>
          <Button variant="destructive" size="sm" onClick={bulkDelete} disabled={bulkDeleting}>
            {bulkDeleting ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
            Delete selected
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected([])}>Clear</Button>
        </div>
      )}

      {loading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-40 animate-pulse rounded-xl bg-muted" />)}</div> : visiblePlayers.length === 0 ? (
        <Card className="border-dashed"><CardContent className="flex flex-col items-center py-14 text-center"><span className="flex size-12 items-center justify-center rounded-full bg-muted"><UserRound className="text-muted-foreground" /></span><h2 className="mt-4 font-semibold">No players found</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">Add players to club rosters before creating match XIs.</p></CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:hidden">
            {visiblePlayers.map((player) => {
              const stat = rangeStats[player.id]
              const isSelected = selected.includes(player.id)
              return (
                <Item
                  key={player.id}
                  variant="outline"
                  size="sm"
                  {...longPressHandlers(player.id)}
                  onClick={() => {
                    if (selectionMode) toggleOne(player.id)
                  }}
                  className={cn(
                    "relative gap-2.5 py-1.5",
                    isSelected && "border-primary ring-2 ring-primary",
                  )}
                >
                  {selectionMode && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2">
                      <SelectionCheck checked={isSelected} />
                    </span>
                  )}
                  <Link
                    href={`/players/${player.id}`}
                    onClick={(event) => {
                      if (selectionMode) event.preventDefault()
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2.5"
                  >
                    <ItemMedia className="size-9 shrink-0 rounded-lg bg-primary/10 text-xs font-black text-primary">
                      {player.jerseyNumber ?? "—"}
                    </ItemMedia>
                    <ItemContent className="min-w-0">
                      <ItemTitle className="truncate text-[13px] leading-tight">{player.name}</ItemTitle>
                      <ItemDescription className="truncate text-[11px]">
                        {clubName(player.clubId)} · {player.role.replaceAll("_", " ").toLowerCase()}
                      </ItemDescription>
                      {rangeActive && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{stat?.runs ?? 0} runs</Badge>
                          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{stat?.wickets ?? 0} wkts</Badge>
                        </span>
                      )}
                    </ItemContent>
                  </Link>
                  <ItemActions className="gap-0.5">
                    {sessionLoading ? (
                      <>
                        <Button variant="ghost" size="icon-sm" disabled aria-label={`Edit ${player.name}`}>
                          <Pencil className="opacity-0" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" disabled aria-label={`Delete ${player.name}`}>
                          <Trash2 className="opacity-0" />
                        </Button>
                      </>
                    ) : canEditPlayer(player) ? (
                      <>
                        <Button variant="ghost" size="icon-sm" onClick={() => startEditing(player)} aria-label={`Edit ${player.name}`}>
                          <Pencil />
                        </Button>
                        <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => deletePlayer(player)} disabled={deletingId === player.id} aria-label={`Delete ${player.name}`}>
                          {deletingId === player.id ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                        </Button>
                      </>
                    ) : null}
                  </ItemActions>
                </Item>
              )
            })}
          </div>
          <Card className="hidden overflow-hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} aria-label="Select all players on this page" />
                  </TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Club</TableHead>
                  <TableHead className="text-right">Jersey</TableHead>
                  <TableHead>Role</TableHead>
                  {rangeActive && <TableHead className="text-right">Runs (range)</TableHead>}
                  {rangeActive && <TableHead className="text-right">Wickets (range)</TableHead>}
                  <TableHead className="text-right">Profile</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagePlayers.map((player) => (
                  <TableRow key={player.id} data-state={selected.includes(player.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.includes(player.id)}
                        onCheckedChange={() => toggleOne(player.id)}
                        disabled={!canEditPlayer(player)}
                        aria-label={`Select ${player.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-semibold">{player.name}</TableCell>
                    <TableCell>{clubName(player.clubId)}</TableCell>
                    <TableCell className="text-right">{player.jerseyNumber ?? "—"}</TableCell>
                    <TableCell>{player.role.replaceAll("_", " ").toLowerCase()}</TableCell>
                    {rangeActive && <TableCell className="text-right font-mono">{rangeStats[player.id]?.runs ?? 0}</TableCell>}
                    {rangeActive && <TableCell className="text-right font-mono">{rangeStats[player.id]?.wickets ?? 0}</TableCell>}
                    <TableCell className="text-right"><Button asChild variant="ghost" size="sm"><Link href={`/players/${player.id}`}>View <ArrowRight /></Link></Button></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {sessionLoading ? (
                          <>
                            <Button variant="outline" size="sm" disabled aria-label={`Edit ${player.name}`}>
                              <Pencil className="opacity-0" />
                              <span className="opacity-0">Edit</span>
                            </Button>
                            <Button variant="destructive" size="sm" disabled aria-label={`Delete ${player.name}`}>
                              <Trash2 className="opacity-0" />
                              <span className="opacity-0">Delete</span>
                            </Button>
                          </>
                        ) : canEditPlayer(player) ? (
                          <>
                            <Button variant="outline" size="sm" onClick={() => startEditing(player)} aria-label={`Edit ${player.name}`}>
                              <Pencil />Edit
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => deletePlayer(player)} disabled={deletingId === player.id} aria-label={`Delete ${player.name}`}>
                              {deletingId === player.id ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                              Delete
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              page={currentPage}
              pageCount={pageCount}
              pageSize={pageSize}
              total={visiblePlayers.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
              label="players"
            />
          </Card>
        </>
      )}
      <SelectionBar
        count={selected.length}
        onClear={() => {
          setSelected([])
          setSelectionMode(false)
        }}
        actions={
          <Button variant="destructive" size="sm" onClick={bulkDelete} disabled={bulkDeleting}>
            {bulkDeleting ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
            Delete
          </Button>
        }
      />
    </div>
  )
}
