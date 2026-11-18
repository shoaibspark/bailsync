"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { RotateCcw, WifiOff, RefreshCw, Settings2 } from "lucide-react"
import toast from "react-hot-toast"
import { apiJson, isNetworkError } from "@/lib/api-client"
import { offlineQueue, flushQueue } from "@/lib/offline-queue"
import { readLocal, writeLocal } from "@/lib/local-cache"
import { useMatchStream } from "@/hooks/use-match-stream"
import { formatOvers, formatStrikeRate } from "@/lib/cricket-engine/formatters"
import { computeDisplayState } from "@/lib/cricket-engine/optimistic"
import type { MatchState, InningsState, BallEventInput, BatterStat } from "@/lib/cricket-engine/types"
import { AnimatedNumber } from "@/components/animated-number"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"

const WICKET_TYPES = ["BOWLED", "CAUGHT", "LBW", "RUN_OUT", "STUMPED", "HIT_WICKET"] as const
const RUN_OPTIONS = [0, 1, 2, 3, 4, 6]
const CACHE_KEY = (matchId: string) => `match:state:${matchId}`

function selectedInnings(state: MatchState): InningsState | null {
  if (state.currentInningsNumber === 1) return state.innings1
  if (state.currentInningsNumber === 2) return state.innings2
  if (state.currentInningsNumber === 3) return state.superOver1
  return state.superOver2
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined") return
    setMobile(window.innerWidth < 768)
    const mq = window.matchMedia("(max-width: 767px)")
    const onChange = (e: MediaQueryListEvent) => setMobile(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  return mobile
}

type WicketStep = "dismissal" | "incoming"

export default function ScoringConsole() {
  const { matchId } = useParams<{ matchId: string }>()
  const isMobile = useIsMobile()
  const stream = useMatchStream(matchId)
  const [serverState, setServerState] = useState<MatchState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [online, setOnline] = useState(typeof navigator !== "undefined" && navigator.onLine)
  const [pending, setPending] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [adds, setAdds] = useState<BallEventInput[]>([])
  const [deletes, setDeletes] = useState<Set<number>>(new Set())
  const seqRef = useRef(0)
  const [announcement, setAnnouncement] = useState("")
  const [selectedBowlerId, setSelectedBowlerId] = useState<string>("")
  const [wicketStep, setWicketStep] = useState<WicketStep | null>(null)
  const [wicketType, setWicketType] = useState<(typeof WICKET_TYPES)[number]>("BOWLED")
  const [dismissedPlayerId, setDismissedPlayerId] = useState("")
  const [incomingBatterId, setIncomingBatterId] = useState("")

  const inningsId = useMemo(() => {
    if (!serverState) return ""
    return serverState.currentInningsId ?? selectedInnings(serverState)?.inningsId ?? ""
  }, [serverState])

  const displayState = useMemo(
    () =>
      serverState
        ? computeDisplayState(serverState, {
            adds,
            deletes,
            matchConfig: serverState.matchConfig,
          })
        : null,
    [serverState, adds, deletes],
  )

  const innings = useMemo(() => (displayState ? selectedInnings(displayState) : null), [displayState])
  const striker = innings?.batters.find((batter) => batter.isOnStrike)
  const nonStriker = innings?.batters.find((batter) => batter.playerId === innings?.nonStrikerId)
  const currentBowler = innings?.bowlers.find((bowler) => bowler.isCurrent)
  const bowlingOptions = useMemo(() => {
    if (!innings || !serverState) return []
    return innings.bowlingXI.map((playerId) => ({
      playerId,
      name: serverState.playerNames[playerId] ?? "Unknown player",
      stat: innings.bowlers.find((bowler) => bowler.playerId === playerId),
    }))
  }, [innings, serverState])
  const bowler = currentBowler
    ? { playerId: currentBowler.playerId, name: currentBowler.name }
    : bowlingOptions.find((option) => option.playerId === selectedBowlerId)
  const bench = innings?.batters.filter(
    (batter) => !batter.isOut && batter.playerId !== striker?.playerId && batter.playerId !== nonStriker?.playerId,
  ) ?? []

  const refresh = useCallback(async () => {
    try {
      const data = await apiJson<MatchState>(`/api/matches/${matchId}/state`, { cache: "no-store" })
      setServerState(data)
      setLoadError(null)
      await writeLocal(CACHE_KEY(matchId), data).catch(() => {})
      return data
    } catch (cause: any) {
      if (!serverState) setLoadError(cause.message ?? "Unable to load the match")
      return null
    }
  }, [matchId, serverState])

  const updatePending = useCallback(async () => {
    const count = await offlineQueue.count(matchId, inningsId)
    setPending(count)
  }, [matchId, inningsId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const cached = await readLocal<MatchState>(CACHE_KEY(matchId))
      if (!cancelled) {
        if (cached?.data) setServerState(cached.data)
        setIsLoading(false)
      }
      const fresh = await refresh()
      if (!cancelled && fresh) setServerState(fresh)
    })()
    return () => {
      cancelled = true
    }
  }, [matchId, refresh])

  useEffect(() => {
    if (stream.state) setServerState(stream.state)
  }, [stream.state, matchId])

  useEffect(() => {
    if (!serverState) return
    const inn = selectedInnings(serverState)
    seqRef.current = (inn?.lastSequenceNumber ?? 0) + 1
  }, [serverState])

  useEffect(() => {
    updatePending()
  }, [updatePending])

  useEffect(() => {
    if (!bowler && bowlingOptions.length > 0) setSelectedBowlerId(bowlingOptions[0].playerId)
  }, [bowler, bowlingOptions])

  const sync = async () => {
    if (!inningsId) return
    setSubmitting(true)
    try {
      const result = await flushQueue(matchId, inningsId)
      await updatePending()
      await refresh()
      if (result.failed) {
        toast.error("Some deliveries could not be synced")
      } else {
        toast.success(`${result.flushed} queued deliveries synced`)
      }
    } catch (cause: any) {
      toast.error(cause.message ?? "Unable to sync queued deliveries")
    } finally {
      setSubmitting(false)
    }
  }

  const postBall = async (event: BallEventInput): Promise<boolean> => {
    if (!online) {
      try {
        await offlineQueue.add(event)
        await updatePending()
        toast.success("Delivery saved on this device and queued for sync")
        setAnnouncement("Delivery saved offline and queued for sync")
        return true
      } catch {
        toast.error("Connection lost and the delivery could not be stored on this device")
        return false
      }
    }
    try {
      await apiJson(`/api/matches/${matchId}/innings/${inningsId}/balls`, {
        method: "POST",
        body: [event],
      })
      setAdds((prev) => prev.filter((e) => e.sequenceNumber !== event.sequenceNumber))
      await refresh()
      toast.success("Delivery recorded")
      const updatedInnings = displayState ? selectedInnings(displayState) : null
      setAnnouncement(
        updatedInnings
          ? `Delivery recorded. Score ${updatedInnings.totalRuns} for ${updatedInnings.wickets} after ${updatedInnings.overs} overs`
          : "Delivery recorded",
      )
      return true
    } catch (cause: any) {
      if (isNetworkError(cause)) {
        try {
          await offlineQueue.add(event)
          await updatePending()
          toast.error("Connection lost. Delivery saved locally for sync")
          setAnnouncement("Connection lost. Delivery saved locally for sync")
          return true
        } catch {
          toast.error("Connection lost and the delivery could not be stored on this device")
          return false
        }
      }
      toast.error(cause.message ?? "Unable to record this delivery")
      return false
    }
  }

  const recordDelivery = useCallback(
    (payload: Partial<Omit<BallEventInput, "sequenceNumber">>) => {
      if (!innings || !inningsId) return
      if (!striker || !nonStriker || !bowler) {
        toast.error("Select two batters and a bowler before recording a delivery")
        return
      }
      const event: BallEventInput = {
        sequenceNumber: seqRef.current++,
        strikerId: striker.playerId,
        nonStrikerId: nonStriker.playerId,
        bowlerId: bowler.playerId,
        runsScored: payload.runsScored ?? 0,
        extraType: payload.extraType ?? "NONE",
        extraRuns: payload.extraRuns ?? 0,
        isWicket: payload.isWicket ?? false,
        wicketType: payload.wicketType,
        dismissedPlayerId: payload.dismissedPlayerId,
        fielderId: payload.fielderId,
        incomingBatterId: payload.incomingBatterId,
        commentaryText: payload.commentaryText,
      }
      setAdds((prev) => [...prev, event])
      postBall(event)
    },
    [innings, inningsId, striker, nonStriker, bowler, postBall],
  )

  const undo = async () => {
    if (!inningsId) return
    setSubmitting(true)
    try {
      if (adds.length > 0) {
        setAdds((prev) => prev.slice(0, -1))
        toast.success("Delivery removed")
      } else {
        const lastSeq = innings?.lastSequenceNumber
        if (lastSeq == null) {
          toast.error("No delivery to undo")
          return
        }
        setDeletes((prev) => new Set(prev).add(lastSeq))
        await apiJson(`/api/matches/${matchId}/innings/${inningsId}/balls/last`, { method: "DELETE" })
        setDeletes((prev) => {
          const next = new Set(prev)
          next.delete(lastSeq)
          return next
        })
        await refresh()
        toast.success("Last delivery undone")
      }
    } catch (cause: any) {
      setDeletes((prev) => {
        const next = new Set(prev)
        next.delete(innings?.lastSequenceNumber ?? -1)
        return next
      })
      toast.error(cause.message ?? "Unable to undo")
    } finally {
      setSubmitting(false)
    }
  }

  // ---- Wicket flow: dismissal + dismissed batter first, incoming batter after ----

  const openWicket = () => {
    setWicketType("BOWLED")
    setDismissedPlayerId(striker?.playerId ?? nonStriker?.playerId ?? "")
    setIncomingBatterId(bench[0]?.playerId ?? "")
    setWicketStep("dismissal")
  }

  const confirmDismissal = () => {
    if (!dismissedPlayerId) return
    const event: BallEventInput = {
      sequenceNumber: seqRef.current++,
      strikerId: striker?.playerId ?? "",
      nonStrikerId: nonStriker?.playerId ?? "",
      bowlerId: bowler?.playerId ?? "",
      runsScored: 0,
      extraType: "NONE",
      extraRuns: 0,
      isWicket: true,
      wicketType,
      dismissedPlayerId,
      incomingBatterId: undefined,
    }
    setAdds((prev) => [...prev, event])
    setWicketStep("incoming")
  }

  const confirmIncoming = () => {
    if (!incomingBatterId) return
    const last = adds[adds.length - 1]
    if (!last) return
    const completed = { ...last, incomingBatterId }
    setAdds((prev) => {
      const copy = [...prev]
      copy[copy.length - 1] = completed
      return copy
    })
    postBall(completed)
    setWicketStep(null)
  }

  const cancelWicket = () => {
    // If the user backs out after recording the dismissal but before picking
    // the incoming batter, drop the incomplete optimistic wicket.
    if (wicketStep === "incoming" && adds.length) {
      setAdds((prev) => prev.slice(0, -1))
    }
    setWicketStep(null)
  }

  const wicketDialogContent = wicketStep === "dismissal" ? (
    <>
      <DialogHeader>
        <DialogTitle>Record wicket</DialogTitle>
        <DialogDescription>Choose the dismissal type and the batter who is out.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2 text-sm font-medium">
          <Label id="wicket-type-label" htmlFor="wicket-type-trigger">Dismissal</Label>
          <Select
            value={wicketType}
            onValueChange={(value) => setWicketType(value as (typeof WICKET_TYPES)[number])}
          >
            <SelectTrigger id="wicket-type-trigger" aria-labelledby="wicket-type-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {WICKET_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2 text-sm font-medium">
          <Label id="batter-out-label" htmlFor="batter-out-trigger">Batter out</Label>
          <Select value={dismissedPlayerId} onValueChange={setDismissedPlayerId}>
            <SelectTrigger id="batter-out-trigger" aria-labelledby="batter-out-label">
              <SelectValue placeholder="Select batter" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {[striker, nonStriker].filter(Boolean).map((batter) => (
                  <SelectItem key={batter!.playerId} value={batter!.playerId}>
                    {batter!.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex h-full items-end"></div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={cancelWicket}>
          Cancel
        </Button>
        <Button onClick={confirmDismissal} disabled={submitting || !dismissedPlayerId}>
          Confirm wicket
        </Button>
      </DialogFooter>
    </>
  ) : (
    <>
      <DialogHeader>
        <DialogTitle>Incoming batter</DialogTitle>
        <DialogDescription>Choose the batter coming in at the fall of the wicket.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2 text-sm font-medium">
          <Label id="incoming-batter-label" htmlFor="incoming-batter-trigger">Incoming batter</Label>
          <Select value={incomingBatterId} onValueChange={setIncomingBatterId}>
            <SelectTrigger id="incoming-batter-trigger" aria-labelledby="incoming-batter-label">
              <SelectValue placeholder="Select batter" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {bench.map((batter) => (
                  <SelectItem key={batter.playerId} value={batter.playerId}>
                    {batter.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex h-full items-end"></div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={cancelWicket}>
          Cancel
        </Button>
        <Button onClick={confirmIncoming} disabled={submitting || !incomingBatterId}>
          Confirm batter
        </Button>
      </DialogFooter>
    </>
  )

  const renderWicketDialog = () => {
    if (wicketStep === null) return null
    const shared = (children: React.ReactNode) => (
      <div className="rounded-xl border bg-muted/30 p-4 sm:p-5">{children}</div>
    )
    if (isMobile) {
      return (
        <Sheet open={wicketStep !== null}>
          <SheetContent className="sm:max-w-md">
            <SheetHeader>
              <SheetTitle>
                {wicketStep === "dismissal" ? "Record wicket" : "Incoming batter"}
              </SheetTitle>
              <SheetDescription>
                {wicketStep === "dismissal"
                  ? "Choose the dismissal type and the batter who is out."
                  : "Choose the batter coming in at the fall of the wicket."}
              </SheetDescription>
            </SheetHeader>
            {wicketStep === "dismissal" ? (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="grid gap-2 text-sm font-medium">
                    <Label htmlFor="wicket-type-trigger-mobile">Dismissal</Label>
                    <Select
                      value={wicketType}
                      onValueChange={(value) => setWicketType(value as (typeof WICKET_TYPES)[number])}
                    >
                      <SelectTrigger id="wicket-type-trigger-mobile">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {WICKET_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type.replaceAll("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2 text-sm font-medium">
                    <Label htmlFor="batter-out-trigger-mobile">Batter out</Label>
                    <Select value={dismissedPlayerId} onValueChange={setDismissedPlayerId}>
                      <SelectTrigger id="batter-out-trigger-mobile">
                        <SelectValue placeholder="Select batter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {[striker, nonStriker].filter(Boolean).map((batter) => (
                            <SelectItem key={batter!.playerId} value={batter!.playerId}>
                              {batter!.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <SheetFooter>
                  <Button variant="outline" onClick={cancelWicket}>
                    Cancel
                  </Button>
                  <Button onClick={confirmDismissal} disabled={submitting || !dismissedPlayerId}>
                    Confirm wicket
                  </Button>
                </SheetFooter>
              </>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="grid gap-2 text-sm font-medium">
                    <Label htmlFor="incoming-batter-trigger-mobile">Incoming batter</Label>
                    <Select value={incomingBatterId} onValueChange={setIncomingBatterId}>
                      <SelectTrigger id="incoming-batter-trigger-mobile">
                        <SelectValue placeholder="Select batter" />
                      </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {bench.map((batter) => (
                              <SelectItem key={batter.playerId} value={batter.playerId}>
                                {batter.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                    </Select>
                  </div>
                </div>
                <SheetFooter>
                  <Button variant="outline" onClick={cancelWicket}>
                    Cancel
                  </Button>
                  <Button onClick={confirmIncoming} disabled={submitting || !incomingBatterId}>
                    Confirm batter
                  </Button>
                </SheetFooter>
              </>
            )}
          </SheetContent>
        </Sheet>
      )
    }
    return (
      <Dialog open={wicketStep !== null}>
        <DialogContent>{shared(wicketDialogContent)}</DialogContent>
      </Dialog>
    )
  }

  if (isLoading && !serverState) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-10">
        <div className="grid lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] gap-5">
          <div className="grid gap-3 lg:grid-cols-1">
            <Card className="h-48"><CardContent className="p-4"><Skeleton className="h-20 mb-2" /><Skeleton className="h-12" /></CardContent></Card>
            <Card className="h-48"><CardContent className="p-4"><Skeleton className="h-20 mb-2" /><Skeleton className="h-12" /></CardContent></Card>
            <Card className="h-60"><CardContent className="p-4"><Skeleton className="h-16 mb-2" /><Skeleton className="h-10" /></CardContent></Card>
          </div>
          <Card className="overflow-hidden h-[560px]">
            <CardContent className="p-4 sm:p-6 h-full flex flex-col gap-4">
              <Skeleton className="h-8 w-3/4" /><Skeleton className="h-6 w-1/2" />
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3 md:grid-cols-6 h-full">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
              <Skeleton className="h-14 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!displayState || loadError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <div className="Alert">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <h3 className="font-semibold text-destructive">{loadError ? "Match unavailable" : "Loading scoring console…"}</h3>
            {loadError && <p className="mt-1 text-sm text-destructive">{loadError}</p>}
          </div>
        </div>
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
          <h1 className="text-balance break-words text-lg font-bold tracking-tight sm:text-3xl">
            {innings.battingClubName} vs {innings.bowlingClubName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Innings {innings.inningsNumber} · {displayState?.homeClub?.name ?? "Home"} vs {displayState?.awayClub?.name ?? "Away"}
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
                  onClick={() => recordDelivery({ runsScored: runs })}
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
                <Button variant="outline" className="h-14" onClick={() => recordDelivery({ runsScored: 0, extraType: "WIDE", extraRuns: 1 })} disabled={submitting || !bowler} aria-label="Record wide, one extra run">
                  Wide +1
                </Button>
                <Button variant="outline" className="h-14" onClick={() => recordDelivery({ runsScored: 0, extraType: "NO_BALL", extraRuns: 1 })} disabled={submitting || !bowler} aria-label="Record no ball, one extra run">
                  No ball +1
                </Button>
                <Button variant="outline" className="h-14" onClick={() => recordDelivery({ runsScored: 0, extraType: "BYE", extraRuns: 1 })} disabled={submitting || !bowler} aria-label="Record bye, one extra run">
                  Bye +1
                </Button>
                <Button variant="outline" className="h-14" onClick={() => recordDelivery({ runsScored: 0, extraType: "LEG_BYE", extraRuns: 1 })} disabled={submitting || !bowler} aria-label="Record leg bye, one extra run">
                  Leg bye +1
                </Button>
              </div>
            </div>

            <Button
              variant="destructive"
              className="h-14 w-full text-base"
              onClick={openWicket}
              disabled={submitting || !bowler || bench.length === 0}
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

            {renderWicketDialog()}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
