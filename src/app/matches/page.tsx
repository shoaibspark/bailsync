"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { CalendarDays, LoaderCircle, MapPin, Plus, Radio, Search, Trash2, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Item, ItemActions } from "@/components/ui/item"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TablePagination } from "@/components/table-pagination"
import { SelectionBar, SelectionCheck } from "@/components/selection-bar"
import { ListSkeleton } from "@/components/list-skeleton"
import { apiJson } from "@/lib/api-client"
import { useCachedData } from "@/hooks/use-cached-data"
import { useLongPressSelect } from "@/hooks/use-long-press-select"
import { useSession } from "@/hooks/use-session"
import { isManager, isSuperadmin } from "@/lib/roles"
import { cn } from "@/lib/utils"

type Match = {
  id: string
  status: "SCHEDULED" | "LIVE" | "INNINGS_BREAK" | "COMPLETED" | "ABANDONED"
  venue: string | null
  scheduledAt: string | null
  oversPerInnings: number
  resultSummary: string | null
  homeClub: { id: string; name: string; shortName: string | null } | null
  awayClub: { id: string; name: string; shortName: string | null } | null
  tournament: { id: string; name: string } | null
}

const filters = ["ALL", "LIVE", "SCHEDULED", "COMPLETED"] as const

function statusVariant(status: Match["status"]) {
  if (status === "LIVE") return "default" as const
  if (status === "COMPLETED") return "secondary" as const
  if (status === "ABANDONED") return "destructive" as const
  return "outline" as const
}

export default function MatchesPage() {
  const router = useRouter()
  const [filter, setFilter] = useState<(typeof filters)[number]>("ALL")
  const [deletingId, setDeletingId] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectionMode, setSelectionMode] = useState(false)
  const { session, status } = useSession()
  const sessionLoading = status === "loading"
  const canManage = isManager(session?.role)

  const matchesCache = useCachedData<Match[]>("matches:list", () => apiJson<Match[]>("/api/matches"))
  const matches = matchesCache.data ?? []
  const loading = matchesCache.isLoading && !matches.length

  const ownsClub = (match: Match) => {
    if (session?.role !== "ADMIN" || !session.clubIds.length) return false
    const home = match.homeClub ? session.clubIds.includes(match.homeClub.id) : false
    const away = match.awayClub ? session.clubIds.includes(match.awayClub.id) : false
    return home || away
  }

  const canDeleteMatch = (match: Match) => isSuperadmin(session?.role) || (ownsClub(match) && match.status === "SCHEDULED")

  const visibleMatches = useMemo(() => {
    const term = query.trim().toLowerCase()
    return matches
      .filter((match) => filter === "ALL" || match.status === filter)
      .filter((match) =>
        !term
          ? true
          : [match.homeClub?.name, match.awayClub?.name, match.venue, match.tournament?.name]
              .filter((field) => field !== null && field !== undefined)
              .some((field) => String(field).toLowerCase().includes(term)),
      )
  }, [filter, matches, query])

  const pageCount = Math.max(1, Math.ceil(visibleMatches.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageMatches = visibleMatches.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const selectableIds = pageMatches.filter((match) => canDeleteMatch(match)).map((match) => match.id)
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

  const deleteMatch = async (match: Match) => {
    const label = `${match.homeClub?.name ?? "Home"} vs ${match.awayClub?.name ?? "Away"}`
    if (!window.confirm(`Delete ${label}? This removes the fixture and its recorded deliveries.`)) return
    setDeletingId(match.id)
    try {
      await apiJson(`/api/matches/${match.id}`, { method: "DELETE" })
      toast.success("Match deleted")
      setSelected((current) => current.filter((id) => id !== match.id))
      await matchesCache.refresh()
      router.refresh()
    } catch (cause: any) {
      toast.error(cause.message ?? "Unable to delete the match")
    } finally {
      setDeletingId("")
    }
  }

  const bulkDelete = async () => {
    if (!selected.length) return
    const count = selected.length
    if (!window.confirm(`Delete ${count} fixture${count === 1 ? "" : "s"}? Recorded deliveries are removed too.`)) return
    setBulkDeleting(true)
    try {
      for (const id of selected) {
        await apiJson(`/api/matches/${id}`, { method: "DELETE" })
      }
      toast.success(`${count} matches deleted`)
      setSelected([])
      await matchesCache.refresh()
      router.refresh()
    } catch (cause: any) {
      toast.error(cause.message ?? "Unable to delete the selected matches")
    } finally {
      setBulkDeleting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary sm:text-xs">
            <Trophy className="size-4" /> Match centre
          </div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight sm:text-3xl">
            Matches
            {!sessionLoading && !canManage && <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px] sm:text-xs">View only</Badge>}
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm sm:text-base">Follow every fixture from toss to result, or start a new match.</p>
        </div>
        {sessionLoading || !canManage ? (
          <Button disabled aria-hidden={sessionLoading || undefined} className="h-8 w-full text-xs sm:h-9 sm:w-auto sm:text-sm">
            <Plus className={cn(sessionLoading && "opacity-0")} />New match
          </Button>
        ) : (
          <Button asChild className="h-8 w-full text-xs sm:h-9 sm:w-auto sm:text-sm">
            <Link href="/matches/new"><Plus />New match</Link>
          </Button>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0" role="tablist" aria-label="Filter matches">
          {filters.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={filter === item}
              onClick={() => {
                setFilter(item)
                setPage(1)
              }}
              className={`h-7 shrink-0 rounded-full border px-2.5 text-[11px] font-semibold sm:h-8 sm:px-3 sm:text-xs transition-colors ${filter === item ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              {item === "ALL" ? "All matches" : item === "LIVE" ? "Live" : item === "SCHEDULED" ? "Upcoming" : "Completed"}
            </button>
          ))}
        </div>
        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
            placeholder="Search fixtures"
            className="h-8 pl-8 text-xs sm:h-9 sm:pl-9 sm:text-sm"
            aria-label="Search matches"
          />
        </div>
      </div>

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

      {loading ? (
        <ListSkeleton columns={7} rows={5} />
      ) : visibleMatches.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted"><Radio className="text-muted-foreground" /></span>
            <h2 className="mt-4 font-semibold">No matches in this view</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Try another filter or create the next fixture for your club.</p>
            {canManage && <Button asChild size="sm" className="mt-4"><Link href="/matches/new"><Plus />Create match</Link></Button>}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3 lg:hidden">
            {pageMatches.map((match) => {
              const isSelected = selected.includes(match.id)
              return (
                <Item
                  key={match.id}
                  variant="outline"
                  size="sm"
                  {...longPressHandlers(match.id)}
                  onClick={() => {
                    if (selectionMode) toggleOne(match.id)
                  }}
                  className={cn(
                    "relative flex-col gap-1.5 py-2",
                    isSelected && "border-primary ring-2 ring-primary",
                  )}
                >
                  {selectionMode && (
                    <span className="absolute right-2 top-2">
                      <SelectionCheck checked={isSelected} />
                    </span>
                  )}
                  <Link
                    href={`/matches/${match.id}`}
                    onClick={(event) => {
                      if (selectionMode) event.preventDefault()
                    }}
                    className="block w-full"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2 pr-6">
                      <Badge variant={statusVariant(match.status)} className="px-1.5 py-0 text-[10px]">
                        {match.status === "LIVE" && <Radio className="size-3 animate-pulse" />}
                        {match.status.replace("_", " ")}
                      </Badge>
                      <span className="truncate text-[11px] text-muted-foreground">{match.tournament?.name ?? "Friendly"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[13px]">
                      <span className="min-w-0 flex-1 truncate font-semibold">{match.homeClub?.shortName || match.homeClub?.name || "Home"}</span>
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">vs</span>
                      <span className="min-w-0 flex-1 truncate text-right font-semibold">{match.awayClub?.shortName || match.awayClub?.name || "Away"}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{match.venue || "Venue TBC"}</span>
                      <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />{match.scheduledAt ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(match.scheduledAt)) : "Schedule pending"}</span>
                    </div>
                    {match.resultSummary && <p className="mt-1 text-xs font-semibold text-foreground">{match.resultSummary}</p>}
                  </Link>
                  {sessionLoading ? (
                    <ItemActions className="justify-end">
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" disabled aria-hidden="true">
                        <Trash2 className="opacity-0" />
                        <span className="invisible">Delete</span>
                      </Button>
                    </ItemActions>
                  ) : canDeleteMatch(match) && (
                    <ItemActions className="justify-end">
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => deleteMatch(match)} disabled={deletingId === match.id} aria-label={`Delete ${match.homeClub?.name ?? "match"} versus ${match.awayClub?.name ?? "match"}`}>
                        {deletingId === match.id ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                        Delete
                      </Button>
                    </ItemActions>
                  )}
                </Item>
              )
            })}
          </div>

          <Card className="mt-5 hidden overflow-hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} aria-label="Select all matches on this page" />
                  </TableHead>
                  <TableHead>Fixture</TableHead>
                  <TableHead>Series</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageMatches.map((match) => (
                  <TableRow key={match.id} data-state={selected.includes(match.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.includes(match.id)}
                        onCheckedChange={() => toggleOne(match.id)}
                        disabled={!canDeleteMatch(match)}
                        aria-label={`Select ${match.homeClub?.name ?? "home"} versus ${match.awayClub?.name ?? "away"}`}
                      />
                    </TableCell>
                    <TableCell className="font-semibold">{match.homeClub?.name ?? "Home"} vs {match.awayClub?.name ?? "Away"}</TableCell>
                    <TableCell>{match.tournament?.name ?? "Friendly"}</TableCell>
                    <TableCell>{match.venue || "—"}</TableCell>
                    <TableCell>{match.scheduledAt ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(match.scheduledAt)) : "TBC"}</TableCell>
                    <TableCell><Badge variant={statusVariant(match.status)}>{match.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild variant="ghost" size="sm"><Link href={`/matches/${match.id}`}>Open</Link></Button>
                        {sessionLoading ? (
                          <Button variant="destructive" size="sm" disabled aria-hidden="true">
                            <Trash2 className="opacity-0" />
                            <span className="invisible">Delete</span>
                          </Button>
                        ) : canDeleteMatch(match) && (
                          <Button variant="destructive" size="sm" onClick={() => deleteMatch(match)} disabled={deletingId === match.id} aria-label={`Delete ${match.homeClub?.name ?? "match"} versus ${match.awayClub?.name ?? "match"}`}>
                            {deletingId === match.id ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                            Delete
                          </Button>
                        )}
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
              total={visibleMatches.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
              label="matches"
            />
          </Card>

          <div className="mt-4 lg:hidden">
            <TablePagination
              page={currentPage}
              pageCount={pageCount}
              pageSize={pageSize}
              total={visibleMatches.length}
              onPageChange={setPage}
              label="matches"
            />
          </div>
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
