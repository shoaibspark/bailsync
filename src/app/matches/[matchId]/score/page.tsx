"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { RotateCcw, WifiOff, RefreshCw, Settings2, CircleAlert } from "lucide-react"
import { apiJson, isNetworkError } from "@/lib/api-client"
import { offlineQueue, flushQueue } from "@/lib/offline-queue"
import { formatOvers, formatStrikeRate } from "@/lib/cricket-engine/formatters"
import type { MatchState, InningsState } from "@/lib/cricket-engine/types"
import { AnimatedNumber } from "@/components/animated-number"

const WICKET_TYPES = ["BOWLED", "CAUGHT", "LBW", "RUN_OUT", "STUMPED", "HIT_WICKET"] as const
const RUN_OPTIONS = [0, 1, 2, 3, 4, 6]

function selectedInnings(state: MatchState): InningsState | null {
  if (state.currentInningsNumber === 1) return state.innings1
  if (state.currentInningsNumber === 2) return state.innings2
  if (state.currentInningsNumber === 3) return state.superOver1
  return state.superOver2
}

export default function ScoringConsole() {
  const { matchId } = useParams<{ matchId: string }>()
  const [state, setState] = useState<MatchState | null>(null)
  const [online, setOnline] = useState(typeof navigator !== "undefined" && navigator.onLine)
  const [pending, setPending] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedBowlerId, setSelectedBowlerId] = useState<string>("")
  const [wicketOpen, setWicketOpen] = useState(false)
  const [wicketType, setWicketType] = useState<(typeof WICKET_TYPES)[number]>("BOWLED")
  const [dismissedPlayerId, setDismissedPlayerId] = useState("")
  const [incomingBatterId, setIncomingBatterId] = useState("")
  const [announcement, setAnnouncement] = useState("")
  const sequence = useRef(Date.now())

  const innings = useMemo(() => (state ? selectedInnings(state) : null), [state])
  const inningsId = state?.currentInningsId ?? innings?.inningsId ?? ""
  const striker = innings?.batters.find((batter) => batter.isOnStrike)
  const nonStriker = innings?.batters.find((batter) => batter.playerId === innings.nonStrikerId)
  const currentBowler = innings?.bowlers.find((bowler) => bowler.isCurrent)
  const bowlingOptions = useMemo(() => {
    if (!innings || !state) return []
    return innings.bowlingXI.map((playerId) => ({
      playerId,
      name: state.playerNames[playerId] ?? "Unknown player",
      stat: innings.bowlers.find((bowler) => bowler.playerId === playerId),
    }))
  }, [innings, state])
  const bowler = currentBowler
    ? { playerId: currentBowler.playerId, name: currentBowler.name }
    : bowlingOptions.find((option) => option.playerId === selectedBowlerId)
  const bench = innings?.batters.filter(
    (batter) => !batter.isOut && batter.playerId !== striker?.playerId && batter.playerId !== nonStriker?.playerId,
  ) ?? []

  const refresh = useCallback(async () => {
    try {
      const data = await apiJson<MatchState>(`/api/matches/${matchId}/state`, { cache: "no-store" })
      setState(data)
      setError(null)
      sequence.current = (selectedInnings(data)?.lastSequenceNumber ?? 0) + 1
      return data
    } catch (cause: any) {
      setError(cause.message ?? "Unable to load the match")
      return null
    }
  }, [matchId])

  const updatePending = useCallback(async () => {
    const count = await offlineQueue.count(matchId, inningsId)
    setPending(count)
  }, [matchId, inningsId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    updatePending()
  }, [updatePending])

  useEffect(() => {
    const sync = async () => {
      setOnline(true)
      if (!inningsId) return
      const result = await flushQueue(matchId, inningsId)
      await updatePending()
      if (result.flushed) await refresh()
    }
    const disconnect = () => setOnline(false)
    window.addEventListener("online", sync)
    window.addEventListener("offline", disconnect)
    return () => {
      window.removeEventListener("online", sync)
      window.removeEventListener("offline", disconnect)
    }
  }, [inningsId, matchId, refresh, updatePending])

  useEffect(() => {
    if (!bowler && bowlingOptions.length > 0) setSelectedBowlerId(bowlingOptions[0].playerId)
  }, [bowler, bowlingOptions])

  const submitBall = async (details: {
    runsScored: number
    extraType?: "NONE" | "WIDE" | "NO_BALL" | "BYE" | "LEG_BYE" | "PENALTY"
    extraRuns?: number
    isWicket?: boolean
    wicketType?: (typeof WICKET_TYPES)[number]
    dismissedPlayerId?: string
    incomingBatterId?: string
  }) => {
    if (!innings || !inningsId) return
    if (!striker || !nonStriker || !bowler) {
      setError("Select two batters and a bowler before recording a delivery")
      return
    }

    const payload = {
      matchId,
      inningsId,
      sequenceNumber: sequence.current++,
      clientEventId: crypto.randomUUID(),
      strikerId: striker.playerId,
      nonStrikerId: nonStriker.playerId,
      bowlerId: bowler.playerId,
      runsScored: details.runsScored,
      extraType: details.extraType ?? "NONE",
      extraRuns: details.extraRuns ?? 0,
      isWicket: details.isWicket ?? false,
      wicketType: details.wicketType,
      dismissedPlayerId: details.dismissedPlayerId,
      incomingBatterId: details.incomingBatterId,
    }

    setSubmitting(true)
    setError(null)
    setNotice(null)
    try {
      if (!online) {
        await offlineQueue.add(payload)
        await updatePending()
        setNotice("Delivery saved on this device and queued for sync")
        setAnnouncement("Delivery saved offline and queued for sync")
        return
      }
      await apiJson(`/api/matches/${matchId}/innings/${inningsId}/balls`, {
        method: "POST",
        body: [payload],
      })
      const updated = await refresh()
      const updatedInnings = updated ? selectedInnings(updated) : null
      setNotice("Delivery recorded")
      setAnnouncement(
        updatedInnings
          ? `Delivery recorded. Score ${updatedInnings.totalRuns} for ${updatedInnings.wickets} after ${updatedInnings.overs} overs`
          : "Delivery recorded",
      )
    } catch (cause: any) {
      if (isNetworkError(cause)) {
        try {
          await offlineQueue.add(payload)
          await updatePending()
          setNotice("Connection lost. Delivery saved locally for sync")
          setAnnouncement("Connection lost. Delivery saved locally for sync")
        } catch {
          setError("Connection lost and the delivery could not be stored on this device")
        }
        return
      }
      setError(cause.message ?? "Unable to record this delivery")
    } finally {
      setSubmitting(false)
    }
  }

  const openWicket = () => {
    setDismissedPlayerId(striker?.playerId ?? nonStriker?.playerId ?? "")
    setIncomingBatterId(bench[0]?.playerId ?? "")
    setWicketType("BOWLED")
    setWicketOpen(true)
  }

  const recordWicket = async () => {
    await submitBall({
      runsScored: 0,
      isWicket: true,
      wicketType,
      dismissedPlayerId,
      incomingBatterId,
    })
    setWicketOpen(false)
  }

  const undo = async () => {
    if (!inningsId || !online) return
    setSubmitting(true)
    try {
      await apiJson(`/api/matches/${matchId}/innings/${inningsId}/balls/last`, { method: "DELETE" })
      await refresh()
      setNotice("Last delivery undone")
    } catch (cause: any) {
      setError(cause.message ?? "Unable to undo the last delivery")
    } finally {
      setSubmitting(false)
    }
  }

  const sync = async () => {
    if (!inningsId) return
    setSubmitting(true)
    try {
      const result = await flushQueue(matchId, inningsId)
      await updatePending()
      await refresh()
      setNotice(result.failed ? "Some deliveries could not be synced" : `${result.flushed} queued deliveries synced`)
    } catch (cause: any) {
      setError(cause.message ?? "Unable to sync queued deliveries")
    } finally {
      setSubmitting(false)
    }
  }

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <Alert>
          <AlertTitle>{error ? "Match unavailable" : "Loading scoring console…"}</AlertTitle>
          {error && <AlertDescription>{error}</AlertDescription>}
        </Alert>
      </div>
    )
  }

  if (!innings || !inningsId || innings.playingXI.length < 2) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <Card>
          <CardHeader>
            <div className="flex size-11 items-center justify-center rounded-full bg-muted">
              <Settings2 />
            </div>
            <CardTitle>Set up the match before scoring</CardTitle>
            <CardDescription>
              Select both playing XIs, record the toss, and start the first innings.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row">
            <Button asChild>
              <Link href={`/matches/${matchId}/setup`}>Open match setup</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/matches/${matchId}`}>View match details</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant={online ? "secondary" : "destructive"}>
              {online ? "Online" : "Offline"}
            </Badge>
            {pending > 0 && <Badge variant="outline">{pending} queued</Badge>}
            {innings.isCompleted && <Badge variant="outline">Innings complete</Badge>}
          </div>
          <h1 className="text-balance break-words text-2xl font-bold tracking-tight sm:text-3xl">
            {innings.battingClubName} vs {innings.bowlingClubName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Innings {innings.inningsNumber} · {state.homeClub?.name ?? "Home"} vs {state.awayClub?.name ?? "Away"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/matches/${matchId}`}>Match centre</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/matches/${matchId}/setup`}>Setup</Link>
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <CircleAlert />
          <AlertTitle>Action needed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <div role="status" aria-live="polite" className="mb-4 rounded-lg border bg-card px-4 py-3 text-sm font-medium shadow-sm">
          {notice}
        </div>
      )}

      <section
        aria-label="Current score"
        className="sticky top-16 z-30 mb-5 rounded-xl border border-primary/20 bg-card/95 p-3 shadow-sm backdrop-blur sm:p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Innings {innings.inningsNumber} · {innings.battingClubName}
            </p>
            <div className="mt-1 flex items-baseline gap-2 font-mono font-bold tracking-tight" aria-hidden="true">
              <AnimatedNumber value={innings.totalRuns} className="text-4xl sm:text-5xl" />
              <span className="mx-1 text-2xl text-muted-foreground sm:text-3xl">/</span>
              <AnimatedNumber value={innings.wickets} className="text-3xl sm:text-4xl" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{formatOvers(innings.legalBalls, 6)} overs</span>
            <span>CRR {innings.crr}</span>
            {innings.targetRuns !== undefined && <span className="font-semibold text-foreground">Target {innings.targetRuns}</span>}
          </div>
        </div>
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {`${innings.totalRuns} runs for ${innings.wickets} wickets after ${innings.overs} overs`}
        </p>
        <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
        <div className="grid gap-3 lg:grid-cols-1">
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Striker</p>
                <p className="mt-2 truncate font-bold">{striker?.name ?? "—"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {striker ? `${striker.runs} (${striker.balls}) · SR ${formatStrikeRate(striker.runs, striker.balls)}` : "Select setup"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Non-striker</p>
                <p className="mt-2 truncate font-bold">{nonStriker?.name ?? "—"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {nonStriker ? `${nonStriker.runs} (${nonStriker.balls})` : "Select setup"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bowler</p>
                  <p className="mt-1 font-bold">{bowler?.name ?? "Choose bowler"}</p>
                </div>
                {currentBowler && <Badge variant="secondary">This over</Badge>}
              </div>
              {!currentBowler && (
                <Select value={selectedBowlerId} onValueChange={setSelectedBowlerId}>
                  <SelectTrigger className="w-full" aria-label="Select bowler">
                    <SelectValue placeholder="Select bowler" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {bowlingOptions.map((option) => (
                        <SelectItem key={option.playerId} value={option.playerId}>
                          {option.name}{option.stat ? ` · ${option.stat.overs}` : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/30 px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold leading-none tracking-tight">Record delivery</h2>
                <CardDescription className="mt-1">Tap the runs scored on this ball.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={undo} disabled={submitting || !online}>
                <RotateCcw data-icon="inline-start" />
                Undo
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 p-4 sm:p-6">
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 md:grid-cols-6">
              {RUN_OPTIONS.map((runs) => (
                <Button
                  key={runs}
                  type="button"
                  className="h-16 text-xl font-bold sm:h-20 sm:text-2xl"
                  variant={runs === 6 ? "destructive" : runs >= 4 ? "secondary" : "default"}
                  onClick={() => submitBall({ runsScored: runs })}
                  disabled={submitting || !bowler}
                  aria-label={`Record ${runs} ${runs === 1 ? "run" : "runs"}`}
                >
                  {runs}
                </Button>
              ))}
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">Extras</p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <Button variant="outline" className="h-14" onClick={() => submitBall({ runsScored: 0, extraType: "WIDE", extraRuns: 1 })} disabled={submitting || !bowler} aria-label="Record wide, one extra run">
                  Wide +1
                </Button>
                <Button variant="outline" className="h-14" onClick={() => submitBall({ runsScored: 0, extraType: "NO_BALL", extraRuns: 1 })} disabled={submitting || !bowler} aria-label="Record no ball, one extra run">
                  No ball +1
                </Button>
                <Button variant="outline" className="h-14" onClick={() => submitBall({ runsScored: 0, extraType: "BYE", extraRuns: 1 })} disabled={submitting || !bowler} aria-label="Record bye, one extra run">
                  Bye +1
                </Button>
                <Button variant="outline" className="h-14" onClick={() => submitBall({ runsScored: 0, extraType: "LEG_BYE", extraRuns: 1 })} disabled={submitting || !bowler} aria-label="Record leg bye, one extra run">
                  Leg bye +1
                </Button>
              </div>
            </div>

            <Button
              variant="destructive"
              className="h-14 w-full text-base"
              onClick={openWicket}
              disabled={submitting || !bowler || bench.length === 0}
              aria-expanded={wicketOpen}
              aria-controls="wicket-details"
            >
              Record wicket
            </Button>

            {pending > 0 && (
              <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <WifiOff className="mt-0.5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-semibold">{pending} deliveries waiting to sync</p>
                    <p className="text-xs text-muted-foreground">Keep this screen open until all deliveries are synced.</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={sync} disabled={submitting || !online}>
                  <RefreshCw data-icon="inline-start" />
                  Sync now
                </Button>
              </div>
            )}

            {wicketOpen && (
              <div id="wicket-details" role="region" aria-labelledby="wicket-details-title" className="rounded-xl border bg-muted/30 p-4 sm:p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 id="wicket-details-title" className="font-semibold">Wicket details</h2>
                    <p className="text-sm text-muted-foreground">Choose how the batter was dismissed and who comes next.</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-11 sm:h-8" onClick={() => setWicketOpen(false)} aria-label="Close wicket details">Close</Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="grid gap-2 text-sm font-medium">
                    <Label id="wicket-type-label" htmlFor="wicket-type-trigger">Dismissal</Label>
                    <Select value={wicketType} onValueChange={(value) => setWicketType(value as (typeof WICKET_TYPES)[number])}>
                      <SelectTrigger id="wicket-type-trigger" aria-labelledby="wicket-type-label"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {WICKET_TYPES.map((type) => <SelectItem key={type} value={type}>{type.replaceAll("_", " ")}</SelectItem>)}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2 text-sm font-medium">
                    <Label id="batter-out-label" htmlFor="batter-out-trigger">Batter out</Label>
                    <Select value={dismissedPlayerId} onValueChange={setDismissedPlayerId}>
                      <SelectTrigger id="batter-out-trigger" aria-labelledby="batter-out-label"><SelectValue placeholder="Select batter" /></SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {[striker, nonStriker].filter(Boolean).map((batter) => (
                            <SelectItem key={batter!.playerId} value={batter!.playerId}>{batter!.name}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2 text-sm font-medium">
                    <Label id="incoming-batter-label" htmlFor="incoming-batter-trigger">Incoming batter</Label>
                    <Select value={incomingBatterId} onValueChange={setIncomingBatterId}>
                      <SelectTrigger id="incoming-batter-trigger" aria-labelledby="incoming-batter-label"><SelectValue placeholder="Select batter" /></SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {bench.map((batter) => <SelectItem key={batter.playerId} value={batter.playerId}>{batter.name}</SelectItem>)}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button className="mt-4 w-full" onClick={recordWicket} disabled={submitting || !dismissedPlayerId || !incomingBatterId}>
                  Confirm wicket
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
