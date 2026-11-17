"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Check, LoaderCircle, ShieldCheck, Swords, UsersRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiJson } from "@/lib/api-client"
import { cn } from "@/lib/utils"

type Club = { id: string; name: string; shortName: string | null }
type Player = { id: string; clubId: string; name: string; jerseyNumber: number | null; role: string }
type MatchDetail = {
  id: string
  status: string
  homeClub: Club
  awayClub: Club
  oversPerInnings: number
  maxOversPerBowler: number
  tossWinnerClubId: string | null
  tossDecision: "BAT" | "BOWL" | null
  squads: Array<{ playerId: string; clubId: string; isPlayingXI: boolean; player: Player }>
  innings: Array<{ id: string; inningsNumber: number; isCompleted: boolean }>
}

function SquadPicker({
  club,
  selected,
  roster,
  onToggle,
}: {
  club: Club
  selected: string[]
  roster: Player[]
  onToggle: (playerId: string, clubId: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{club.name}</CardTitle>
            <CardDescription>Select exactly 11 players for the XI.</CardDescription>
          </div>
          <Badge variant={selected.length === 11 ? "default" : "outline"}>{selected.length}/11</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2">
          {roster.map((player) => {
            const checked = selected.includes(player.id)
            const disabled = !checked && selected.length >= 11
            return (
              <label key={player.id} className={cn("flex min-h-12 items-center gap-3 rounded-lg border p-3 transition-colors", checked ? "border-primary bg-primary/[0.05]" : "hover:bg-muted/60", disabled && "opacity-45")}>
                <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => onToggle(player.id, club.id)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{player.name}</span>
                  <span className="block text-xs text-muted-foreground">{player.jerseyNumber ? `#${player.jerseyNumber}` : player.role.replaceAll("_", " ").toLowerCase()}</span>
                </span>
                {checked && <Check className="size-4 text-primary" />}
              </label>
            )
          })}
        </div>
        {roster.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No players registered for this club.</p>}
      </CardContent>
    </Card>
  )
}

export default function MatchSetupPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const router = useRouter()
  const [match, setMatch] = useState<MatchDetail | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [tossWinner, setTossWinner] = useState("")
  const [decision, setDecision] = useState<"BAT" | "BOWL">("BAT")
  const [homeXI, setHomeXI] = useState<string[]>([])
  const [awayXI, setAwayXI] = useState<string[]>([])
  const [overs, setOvers] = useState(20)
  const [maxOvers, setMaxOvers] = useState(4)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    apiJson<MatchDetail>(`/api/matches/${matchId}`)
      .then(async (detail) => {
        const roster = await Promise.all([
          apiJson<Player[]>(`/api/players?clubId=${detail.homeClub.id}`),
          apiJson<Player[]>(`/api/players?clubId=${detail.awayClub.id}`),
        ])
        if (!active) return
        setMatch(detail)
        setPlayers([...roster[0], ...roster[1]])
        setTossWinner(detail.tossWinnerClubId || detail.homeClub.id)
        setDecision(detail.tossDecision || "BAT")
        setOvers(detail.oversPerInnings)
        setMaxOvers(detail.maxOversPerBowler)
        setHomeXI(detail.squads.filter((squad) => squad.clubId === detail.homeClub.id && squad.isPlayingXI).map((squad) => squad.playerId))
        setAwayXI(detail.squads.filter((squad) => squad.clubId === detail.awayClub.id && squad.isPlayingXI).map((squad) => squad.playerId))
      })
      .catch((cause: any) => {
        if (active) setError(cause.message ?? "Unable to load match setup")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [matchId])

  const homePlayers = useMemo(() => players.filter((player) => player.clubId === match?.homeClub.id), [match, players])
  const awayPlayers = useMemo(() => players.filter((player) => player.clubId === match?.awayClub.id), [match, players])

  const togglePlayer = (playerId: string, clubId: string) => {
    const isHome = clubId === match?.homeClub.id
    const current = isHome ? homeXI : awayXI
    const next = current.includes(playerId)
      ? current.filter((id) => id !== playerId)
      : current.length < 11 ? [...current, playerId] : current
    if (isHome) setHomeXI(next)
    else setAwayXI(next)
  }

  const submit = async () => {
    if (!match) return
    setError("")
    setSubmitting(true)
    try {
      await apiJson(`/api/matches/${match.id}/setup`, {
        method: "POST",
        body: {
          tossWinnerClubId: tossWinner,
          tossDecision: decision,
          oversPerInnings: overs,
          maxOversPerBowler: maxOvers,
          homePlayerIds: homeXI,
          awayPlayerIds: awayXI,
        },
      })
      router.push(`/matches/${match.id}/score`)
      router.refresh()
    } catch (cause: any) {
      setError(cause.message ?? "Unable to start the match")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-5xl px-4 py-10"><div className="h-80 animate-pulse rounded-2xl bg-muted" /></div>
  }

  if (!match) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Alert variant="destructive"><AlertTitle>Setup unavailable</AlertTitle><AlertDescription>{error || "Match not found"}</AlertDescription></Alert>
      </div>
    )
  }

  const ready = homeXI.length === 11 && awayXI.length === 11 && Boolean(tossWinner)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-9 lg:px-8">
      <Button asChild variant="ghost" size="sm" className="mb-5 -ml-2"><Link href={`/matches/${match.id}`}><ArrowLeft />Back to match</Link></Button>
      <div className="mb-7">
        <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary sm:text-xs"><ShieldCheck className="size-4" /> Match setup</div>
        <h1 className="text-lg font-bold tracking-tight sm:text-3xl sm:text-4xl">{match.homeClub.name} vs {match.awayClub.name}</h1>
        <p className="mt-2 text-muted-foreground">Record the toss, confirm both XIs, and make the first innings ready.</p>
      </div>

      {error && <Alert variant="destructive" className="mb-5"><AlertTitle>Setup could not be saved</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-5 lg:sticky lg:top-24">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Swords className="size-5" /> Toss</CardTitle><CardDescription>Choose who won the toss and what they chose.</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label>Toss winner</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[match.homeClub, match.awayClub].map((club) => (
                    <button key={club.id} type="button" onClick={() => setTossWinner(club.id)} aria-pressed={tossWinner === club.id} className={cn("min-h-12 rounded-lg border px-3 text-sm font-semibold transition-colors", tossWinner === club.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>
                      {club.shortName || club.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Decision</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["BAT", "BOWL"] as const).map((item) => (
                    <button key={item} type="button" onClick={() => setDecision(item)} aria-pressed={decision === item} className={cn("min-h-12 rounded-lg border px-3 text-sm font-semibold transition-colors", decision === item ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>
                      {item === "BAT" ? "Bat first" : "Bowl first"}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Match rules</CardTitle><CardDescription>These can be changed from the tournament defaults.</CardDescription></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2"><Label htmlFor="setup-overs">Overs</Label><Input id="setup-overs" type="number" min={1} max={50} value={overs} onChange={(event) => setOvers(event.target.valueAsNumber || 1)} /></div>
              <div className="flex flex-col gap-2"><Label htmlFor="setup-max-overs">Max per bowler</Label><Input id="setup-max-overs" type="number" min={1} max={20} value={maxOvers} onChange={(event) => setMaxOvers(event.target.valueAsNumber || 1)} /></div>
            </CardContent>
          </Card>

          <Button size="lg" className="w-full" disabled={!ready || submitting} onClick={submit}>
            {submitting ? <LoaderCircle className="animate-spin" /> : <UsersRound />}
            {submitting ? "Starting match…" : "Start scoring"}
            {!submitting && <ArrowRight />}
          </Button>
          {!ready && <p className="text-center text-xs text-muted-foreground">Select 11 players for each team to continue.</p>}
        </div>

        <div className="grid gap-5">
          <SquadPicker club={match.homeClub} selected={homeXI} roster={homePlayers} onToggle={togglePlayer} />
          <SquadPicker club={match.awayClub} selected={awayXI} roster={awayPlayers} onToggle={togglePlayer} />
        </div>
      </div>
    </div>
  )
}
