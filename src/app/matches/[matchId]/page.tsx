"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Activity, ArrowRight, Clock3, LoaderCircle, Pencil, Radio, Save, Settings2, Trash2, Trophy } from "lucide-react"
import toast from "react-hot-toast"
import { useMatchStream } from "@/hooks/use-match-stream"
import { formatStrikeRate, wicketTypeLabel } from "@/lib/cricket-engine/formatters"
import { readLocal, writeLocal } from "@/lib/local-cache"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableCaption, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { AnimatedNumber } from "@/components/animated-number"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiJson } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { isSuperadmin } from "@/lib/roles"
import type { InningsState, MatchState } from "@/lib/cricket-engine/types"

const CACHE_KEY = (matchId: string) => `match:state:${matchId}`

type MatchDetails = {
  id: string
  status: "SCHEDULED" | "LIVE" | "INNINGS_BREAK" | "COMPLETED" | "ABANDONED"
  venue: string | null
  scheduledAt: string | null
  oversPerInnings: number
  maxOversPerBowler: number
  homeClubId: string
  awayClubId: string
}

function currentInnings(state: MatchState): InningsState | null {
  if (state.currentInningsNumber === 1) return state.innings1
  if (state.currentInningsNumber === 2) return state.innings2
  if (state.currentInningsNumber === 3) return state.superOver1
  return state.superOver2
}

function inningsSummary(innings: InningsState | null) {
  if (!innings) return null
  return `${innings.totalRuns}/${innings.wickets} (${innings.overs})`
}

function toLocalInputValue(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export default function MatchPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const router = useRouter()
  const { state: streamState, connected, connecting, reconnecting } = useMatchStream(matchId)
  const { session, status } = useSession()
  const sessionLoading = status === "loading"
  const [managing, setManaging] = useState(false)
  const [matchDetails, setMatchDetails] = useState<MatchDetails | null>(null)
  const [manageForm, setManageForm] = useState({ venue: "", scheduledAt: "", oversPerInnings: 20, maxOversPerBowler: 4, status: "SCHEDULED" as MatchDetails["status"] })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [cachedState, setCachedState] = useState<MatchState | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Show cached data instantly, then keep it fresh from the stream + API in the background.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const entry = await readLocal<MatchState>(CACHE_KEY(matchId))
      if (!cancelled && entry?.data) {
        setCachedState(entry.data)
      }
      setIsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [matchId])

  useEffect(() => {
    ;(async () => {
      try {
        const data = await apiJson<MatchState>(`/api/matches/${matchId}/state`, { cache: "no-store" })
        setCachedState(data)
        await writeLocal(CACHE_KEY(matchId), data).catch(() => {})
      } catch {
        // fall back to whatever cache/stream provides
      }
    })()
  }, [matchId])

  useEffect(() => {
    if (streamState) setCachedState(streamState)
  }, [streamState, matchId])

  const state = streamState ?? cachedState
  const innings = state ? currentInnings(state) : null
  const setupPath = `/matches/${matchId}/setup`
  const scorePath = `/matches/${matchId}/score`
  const setupHref = status !== "authenticated" ? `/login?callbackUrl=${encodeURIComponent(setupPath)}` : setupPath
  const scoreHref = status !== "authenticated" ? `/login?callbackUrl=${encodeURIComponent(scorePath)}` : scorePath

  const canManageMatch = Boolean(
    state && session && (
      isSuperadmin(session.role) ||
      (session.role === "ADMIN" && (
        (state.homeClub?.id && session.clubIds.includes(state.homeClub.id)) ||
        (state.awayClub?.id && session.clubIds.includes(state.awayClub.id))
      ))
    ),
  )

  const openManage = useCallback(async () => {
    setManaging(true)
    try {
      const details = await apiJson<MatchDetails>(`/api/matches/${matchId}`)
      setMatchDetails(details)
      setManageForm({
        venue: details.venue ?? "",
        scheduledAt: toLocalInputValue(details.scheduledAt),
        oversPerInnings: details.oversPerInnings,
        maxOversPerBowler: details.maxOversPerBowler,
        status: details.status,
      })
    } catch (cause: any) {
      toast.error(cause.message ?? "Unable to load match details")
      setManaging(false)
    }
  }, [matchId])

  const saveMatch = async () => {
    setSaving(true)
    try {
      await apiJson(`/api/matches/${matchId}`, {
        method: "PATCH",
        body: {
          venue: manageForm.venue || null,
          scheduledAt: manageForm.scheduledAt ? new Date(manageForm.scheduledAt).toISOString() : null,
          oversPerInnings: manageForm.oversPerInnings,
          maxOversPerBowler: manageForm.maxOversPerBowler,
          status: manageForm.status,
        },
      })
      toast.success("Match details updated")
      router.refresh()
    } catch (cause: any) {
      toast.error(cause.message ?? "Unable to update the match")
    } finally {
      setSaving(false)
    }
  }

  const deleteMatch = async () => {
    if (!window.confirm("Delete this match? The fixture and every recorded delivery will be removed.")) return
    setDeleting(true)
    try {
      await apiJson(`/api/matches/${matchId}`, { method: "DELETE" })
      router.push("/matches")
      router.refresh()
    } catch (cause: any) {
      toast.error(cause.message ?? "Unable to delete the match")
      setDeleting(false)
    }
  }

  if (!state) {
    if (isLoading) {
      return (
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
          {/* Header section */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <div className="h-8 w-24 animate-pulse rounded-full bg-muted" />
              </div>
              <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
              <div className="mt-2 h-4 w-72 animate-pulse rounded-md bg-muted" />
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="h-11 w-20 animate-pulse rounded-md bg-muted" />
              <div className="h-11 w-24 animate-pulse rounded-md bg-muted" />
              <div className="h-11 w-16 animate-pulse rounded-md bg-muted" />
            </div>
          </div>

          {/* Scorecard section */}
          <section className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
            <div className="relative grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <div className="h-4 w-20 animate-pulse rounded-md bg-muted" />
                <div className="mt-2 h-10 w-48 animate-pulse rounded-md bg-muted" />
                <div className="mt-4 flex items-baseline gap-2">
                  <div className="h-20 w-32 animate-pulse rounded-md bg-accent" />
                  <div className="h-10 w-2 animate-pulse rounded-md bg-muted" />
                  <div className="h-16 w-24 animate-pulse rounded-md bg-accent" />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
                  <div className="h-5 w-24 animate-pulse rounded-md bg-muted" />
                  <div className="h-5 w-20 animate-pulse rounded-md bg-muted" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:flex">
                <div className="min-w-0 rounded-xl border p-3 text-center h-16 animate-pulse rounded-xl bg-muted" />
                <div className="min-w-0 rounded-xl border p-3 text-center h-16 animate-pulse rounded-xl bg-muted" />
              </div>
            </div>
          </section>

          {/* Innings summary cards */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="h-16 animate-pulse rounded-xl border bg-muted" />
            <div className="h-16 animate-pulse rounded-xl border bg-muted" />
          </div>

          {/* Tabs */}
          <Separator className="my-7" />
          <div className="h-11 w-48 animate-pulse rounded-md bg-muted" />

          {/* Batting / Bowling cards */}
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card className="min-w-0 h-80">
              <CardContent className="px-0 sm:px-2">
                <div className="h-10 w-24 animate-pulse rounded-md bg-muted" />
                <div className="divide-y space-y-3 mt-4">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                    <div key={i} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="h-4 w-32 animate-pulse rounded-md bg-muted" />
                        <div className="mt-1 h-4 w-20 animate-pulse rounded-md bg-muted" />
                      </div>
                      <div className="grid shrink-0 grid-cols-4 gap-x-3 gap-y-1 text-right text-xs">
                        <div className="h-4 w-8 animate-pulse rounded-md bg-muted" />
                        <div className="h-4 w-8 animate-pulse rounded-md bg-muted" />
                        <div className="h-4 w-8 animate-pulse rounded-md bg-muted" />
                        <div className="h-4 w-8 animate-pulse rounded-md bg-muted" />
                        <div className="col-span-4 h-4 w-16 animate-pulse rounded-md bg-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="min-w-0 h-80">
              <CardContent className="px-0 sm:px-2">
                <div className="h-10 w-24 animate-pulse rounded-md bg-muted" />
                <div className="divide-y space-y-3 mt-4">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
                        <div className="mt-1 h-4 w-20 animate-pulse rounded-md bg-muted" />
                      </div>
                      <div className="grid shrink-0 grid-cols-4 gap-x-3 gap-y-1 text-right text-xs">
                        <div className="h-4 w-8 animate-pulse rounded-md bg-muted" />
                        <div className="h-4 w-8 animate-pulse rounded-md bg-muted" />
                        <div className="h-4 w-8 animate-pulse rounded-md bg-muted" />
                        <div className="h-4 w-8 animate-pulse rounded-md bg-muted" />
                        <div className="col-span-4 h-4 w-16 animate-pulse rounded-md bg-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Commentary */}
          <Card className="mt-5 h-64">
            <CardContent>
              <div className="h-10 w-24 animate-pulse rounded-md bg-muted" />
              <div className="flex flex-col divide-y space-y-2 mt-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 py-3">
                    <div className="min-w-14 justify-center font-mono h-8 w-14 animate-pulse rounded-md bg-muted" />
                    <div className="min-w-0">
                      <div className="h-4 w-40 animate-pulse rounded-md bg-muted" />
                      <div className="mt-1 h-4 w-32 animate-pulse rounded-md bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <Alert>
          <Activity />
          <AlertTitle>No scorecard data</AlertTitle>
          <AlertDescription>The match feed hasn&apos;t returned any data yet. Check your connection and refresh.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const recentBalls = innings?.oversTimeline.flatMap((over) => over.balls).slice(-30).reverse() ?? []

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant={connected ? "default" : "secondary"}>
              {connected ? <Radio className="size-3 animate-pulse" /> : <Clock3 className="size-3" />}
              {connected ? "Live" : connecting || reconnecting || isLoading ? "Connecting…" : "Disconnected"}
            </Badge>
            {state.resultSummary && <Badge variant="outline">{state.resultSummary}</Badge>}
          </div>
          <h1 className="text-balance text-lg font-bold tracking-tight sm:text-3xl lg:text-4xl">
            {state.homeClub?.name ?? "Home club"} <span className="text-muted-foreground">vs</span> {state.awayClub?.name ?? "Away club"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {state.matchConfig.oversPerInnings}-over match · {state.matchConfig.maxOversPerBowler} overs per bowler
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="h-11 sm:h-8"><Link href={setupHref}><Settings2 />Setup</Link></Button>
          <Button asChild size="sm" className="h-11 sm:h-8"><Link href={scoreHref}>Scoring console<ArrowRight /></Link></Button>
          {sessionLoading ? (
            <Button variant="ghost" size="sm" className="h-11 sm:h-8" disabled aria-label="Manage">
              <Pencil className="opacity-0" />
              <span className="opacity-0">Manage</span>
            </Button>
          ) : canManageMatch && (
            <Button variant="ghost" size="sm" className="h-11 sm:h-8" onClick={openManage} disabled={managing}>
              {managing ? <LoaderCircle className="animate-spin" /> : <Pencil />}
              Manage
            </Button>
          )}
        </div>
      </div>

      {canManageMatch && managing && matchDetails && (
        <Card className="mb-6 border-primary/30 bg-primary/[0.03]">
          <CardHeader>
            <h2 className="text-lg font-semibold leading-none tracking-tight">Manage match</h2>
            <CardDescription className="mt-1.5">Update the fixture details or remove the match entirely.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr_0.7fr_0.7fr_1fr] lg:items-end">
              <div className="flex flex-col gap-2">
                <Label htmlFor="manage-venue">Venue</Label>
                <Input id="manage-venue" value={manageForm.venue} onChange={(event) => setManageForm((current) => ({ ...current, venue: event.target.value }))} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="manage-scheduled-at">Start time</Label>
                <Input id="manage-scheduled-at" type="datetime-local" value={manageForm.scheduledAt} onChange={(event) => setManageForm((current) => ({ ...current, scheduledAt: event.target.value }))} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="manage-overs">Overs</Label>
                <Input id="manage-overs" type="number" min={1} max={50} value={manageForm.oversPerInnings} onChange={(event) => setManageForm((current) => ({ ...current, oversPerInnings: Number(event.target.value) }))} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="manage-max-overs">Max per bowler</Label>
                <Input id="manage-max-overs" type="number" min={1} max={20} value={manageForm.maxOversPerBowler} onChange={(event) => setManageForm((current) => ({ ...current, maxOversPerBowler: Number(event.target.value) }))} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="manage-status">Status</Label>
                <Select value={manageForm.status} onValueChange={(value) => setManageForm((current) => ({ ...current, status: value as MatchDetails["status"] }))}>
                  <SelectTrigger id="manage-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                      <SelectItem value="LIVE">Live</SelectItem>
                      <SelectItem value="INNINGS_BREAK">Innings break</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="ABANDONED">Abandoned</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
              <Button onClick={saveMatch} disabled={saving}>
                {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
                Save changes
              </Button>
              <Button variant="ghost" onClick={() => setManaging(false)}>Cancel</Button>
              <Button variant="destructive" className="sm:ml-auto" onClick={deleteMatch} disabled={deleting}>
                {deleting ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                Delete match
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!innings ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted"><Trophy className="text-muted-foreground" /></span>
            <h2 className="mt-4 font-semibold">The scorecard is ready for setup</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Record the toss, confirm both XIs, and start the first innings to begin scoring.</p>
            <Button asChild className="mt-4"><Link href={setupHref}>Set up match</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
            <div className="absolute -right-16 -top-20 size-64 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Innings {innings.inningsNumber}</p>
                <h2 className="mt-2 text-xl font-bold break-words sm:text-2xl">{innings.battingClubName} batting</h2>
                <div className="mt-4 flex items-baseline gap-2 font-mono font-black tracking-tight" aria-hidden="true">
                  <AnimatedNumber value={innings.totalRuns} className="text-5xl sm:text-7xl" />
                  <span className="text-3xl text-muted-foreground sm:text-4xl">/</span>
                  <AnimatedNumber value={innings.wickets} className="text-4xl sm:text-6xl" />
                </div>
                <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                  {`${innings.totalRuns} runs for ${innings.wickets} wickets after ${innings.overs} overs`}
                </p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                  <span>{innings.overs} overs</span>
                  <span>CRR {innings.crr}</span>
                  {innings.targetRuns !== undefined && <span className="font-semibold text-foreground">Target {innings.targetRuns}</span>}
                  {innings.runsRemaining > 0 && <span>{innings.runsRemaining} runs needed</span>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:flex">
                <div className="min-w-0 rounded-xl border bg-background/70 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Striker</p>
                  <p className="mt-1 truncate font-bold" title={innings.batters.find((batter) => batter.isOnStrike)?.name}>{innings.batters.find((batter) => batter.isOnStrike)?.name ?? "—"}</p>
                </div>
                <div className="min-w-0 rounded-xl border bg-background/70 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Bowler</p>
                  <p className="mt-1 truncate font-bold" title={innings.bowlers.find((bowler) => bowler.isCurrent)?.name}>{innings.bowlers.find((bowler) => bowler.isCurrent)?.name ?? "—"}</p>
                </div>
              </div>
            </div>
          </section>

          {(state.innings1 || state.innings2) && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[state.innings1, state.innings2].map((item, index) => item && (
                <Card key={item.inningsId} className={item.inningsNumber === innings.inningsNumber ? "border-primary/30" : ""}>
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Innings {index + 1} · {item.battingClubName}</p>
                      <p className="mt-1 font-mono text-lg font-bold">{inningsSummary(item)}</p>
                    </div>
                    {item.inningsNumber === innings.inningsNumber && <Badge>Current</Badge>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Separator className="my-7" />

          <Tabs defaultValue="scorecard">
            <TabsList className="grid h-11 w-full max-w-md grid-cols-2">
              <TabsTrigger value="scorecard" className="h-full">Scorecard</TabsTrigger>
              <TabsTrigger value="commentary" className="h-full">Commentary</TabsTrigger>
            </TabsList>

            <TabsContent value="scorecard" className="mt-5">
              <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <Card className="min-w-0">
                  <CardHeader><h2 className="text-lg font-semibold leading-none tracking-tight">Batting</h2><CardDescription className="mt-1.5">{innings.battingClubName}</CardDescription></CardHeader>
                  <CardContent className="px-0 sm:px-2">
                    <div className="divide-y sm:hidden">
                      {innings.batters.map((batter) => (
                        <div key={batter.playerId} className="flex items-start justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <p className="font-semibold">
                              {batter.name}
                              {batter.isOnStrike && <span className="ml-2 text-xs font-semibold text-primary">On strike</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {batter.isOut ? (batter.dismissal?.how ? wicketTypeLabel(batter.dismissal.how) : "Out") : "Not out"}
                            </p>
                          </div>
                          <dl className="grid shrink-0 grid-cols-4 gap-x-3 gap-y-1 text-right text-xs">
                            <div><dt className="text-muted-foreground">R</dt><dd className="font-mono text-sm font-semibold">{batter.runs}</dd></div>
                            <div><dt className="text-muted-foreground">B</dt><dd className="font-mono text-sm">{batter.balls}</dd></div>
                            <div><dt className="text-muted-foreground">4s</dt><dd className="font-mono text-sm">{batter.fours}</dd></div>
                            <div><dt className="text-muted-foreground">6s</dt><dd className="font-mono text-sm">{batter.sixes}</dd></div>
                            <div className="col-span-4"><dt className="sr-only">Strike rate</dt><dd className="font-mono text-sm text-muted-foreground">SR {formatStrikeRate(batter.runs, batter.balls)}</dd></div>
                          </dl>
                        </div>
                      ))}
                    </div>
                    <div className="hidden sm:block">
                      <Table>
                        <TableCaption className="sr-only">{`${innings.battingClubName} batting scorecard for innings ${innings.inningsNumber}`}</TableCaption>
                        <TableHeader>
                          <TableRow>
                            <TableHead scope="col">Batter</TableHead>
                            <TableHead scope="col" className="text-right"><span aria-hidden="true">R</span><span className="sr-only">Runs</span></TableHead>
                            <TableHead scope="col" className="text-right"><span aria-hidden="true">B</span><span className="sr-only">Balls</span></TableHead>
                            <TableHead scope="col" className="text-right"><span aria-hidden="true">4</span><span className="sr-only">Fours</span></TableHead>
                            <TableHead scope="col" className="text-right"><span aria-hidden="true">6</span><span className="sr-only">Sixes</span></TableHead>
                            <TableHead scope="col" className="text-right"><span aria-hidden="true">SR</span><span className="sr-only">Strike rate</span></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {innings.batters.map((batter) => (
                            <TableRow key={batter.playerId} className={batter.isOnStrike ? "bg-primary/[0.04]" : ""}>
                              <TableCell className="max-w-40 whitespace-normal font-medium">
                                {batter.name}
                                {batter.isOnStrike && <span className="ml-2 text-xs font-semibold text-primary">On strike</span>}
                                {batter.isOut && <span className="block text-xs text-muted-foreground">{batter.dismissal?.how ? wicketTypeLabel(batter.dismissal.how) : "Out"}</span>}
                              </TableCell>
                              <TableCell className="text-right font-semibold">{batter.runs}</TableCell>
                              <TableCell className="text-right">{batter.balls}</TableCell>
                              <TableCell className="text-right">{batter.fours}</TableCell>
                              <TableCell className="text-right">{batter.sixes}</TableCell>
                              <TableCell className="text-right">{formatStrikeRate(batter.runs, batter.balls)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card className="min-w-0">
                  <CardHeader><h2 className="text-lg font-semibold leading-none tracking-tight">Bowling</h2><CardDescription className="mt-1.5">{innings.bowlingClubName}</CardDescription></CardHeader>
                  <CardContent className="px-0 sm:px-2">
                    <div className="divide-y sm:hidden">
                      {innings.bowlers.map((bowler) => (
                        <div key={bowler.playerId} className="flex items-start justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <p className="font-semibold">{bowler.name}</p>
                            <p className="text-xs text-muted-foreground">{bowler.isCurrent ? "Bowling this over" : "Bowled earlier"}</p>
                          </div>
                          <dl className="grid shrink-0 grid-cols-4 gap-x-3 gap-y-1 text-right text-xs">
                            <div><dt className="text-muted-foreground">O</dt><dd className="font-mono text-sm">{bowler.overs}</dd></div>
                            <div><dt className="text-muted-foreground">M</dt><dd className="font-mono text-sm">{bowler.maidens}</dd></div>
                            <div><dt className="text-muted-foreground">W</dt><dd className="font-mono text-sm font-semibold">{bowler.wickets}</dd></div>
                            <div><dt className="text-muted-foreground">Econ</dt><dd className="font-mono text-sm">{bowler.economy}</dd></div>
                            <div className="col-span-4"><dt className="sr-only">Runs conceded</dt><dd className="font-mono text-sm text-muted-foreground">{bowler.runsConceded} runs conceded</dd></div>
                          </dl>
                        </div>
                      ))}
                    </div>
                    <div className="hidden sm:block">
                      <Table>
                        <TableCaption className="sr-only">{`${innings.bowlingClubName} bowling figures for innings ${innings.inningsNumber}`}</TableCaption>
                        <TableHeader>
                          <TableRow>
                            <TableHead scope="col">Bowler</TableHead>
                            <TableHead scope="col" className="text-right"><span aria-hidden="true">O</span><span className="sr-only">Overs</span></TableHead>
                            <TableHead scope="col" className="text-right"><span aria-hidden="true">M</span><span className="sr-only">Maidens</span></TableHead>
                            <TableHead scope="col" className="text-right"><span aria-hidden="true">R</span><span className="sr-only">Runs conceded</span></TableHead>
                            <TableHead scope="col" className="text-right"><span aria-hidden="true">W</span><span className="sr-only">Wickets</span></TableHead>
                            <TableHead scope="col" className="text-right"><span aria-hidden="true">Econ</span><span className="sr-only">Economy</span></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {innings.bowlers.map((bowler) => (
                            <TableRow key={bowler.playerId} className={bowler.isCurrent ? "bg-primary/[0.04]" : ""}>
                              <TableCell className="max-w-40 whitespace-normal font-medium">{bowler.name}</TableCell>
                              <TableCell className="text-right">{bowler.overs}</TableCell>
                              <TableCell className="text-right">{bowler.maidens}</TableCell>
                              <TableCell className="text-right">{bowler.runsConceded}</TableCell>
                              <TableCell className="text-right font-semibold">{bowler.wickets}</TableCell>
                              <TableCell className="text-right">{bowler.economy}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="commentary" className="mt-5">
              <Card>
                <CardHeader><h2 className="text-lg font-semibold leading-none tracking-tight">Recent deliveries</h2><CardDescription className="mt-1.5">Latest activity from the current innings.</CardDescription></CardHeader>
                <CardContent>
                  {recentBalls.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No deliveries have been recorded yet.</p>
                  ) : (
                    <div className="flex flex-col divide-y">
                      {recentBalls.map((ball) => (
                        <div key={ball.sequenceNumber} className="flex items-center gap-4 py-3">
                          <Badge variant={ball.isWicket ? "destructive" : ball.runsScored >= 4 ? "default" : "secondary"} className="min-w-14 justify-center font-mono">
                            {ball.isWicket ? "W" : ball.runsScored + (ball.extraRuns || 0)}
                          </Badge>
                          <div className="min-w-0">
                            <p className="font-medium">{ball.commentaryText || (ball.isWicket ? "Wicket" : `${ball.runsScored} run${ball.runsScored === 1 ? "" : "s"} scored`)}</p>
                            <p className="text-xs text-muted-foreground">Over {ball.overNumber}.{ball.ballInOver}{ball.extraType !== "NONE" ? ` · ${ball.extraType.replaceAll("_", " ").toLowerCase()}` : ""}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
