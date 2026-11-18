"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { format } from "date-fns"
import { ArrowLeft, Award, BarChart3, Shield, TrendingUp } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AnimatedNumber } from "@/components/animated-number"
import { DateRangePicker, type DateRange } from "@/components/date-range-picker"
import { Button } from "@/components/ui/button"
import { useCachedData } from "@/hooks/use-cached-data"
import { useSession } from "@/hooks/use-session"

type Stats = {
  name: string
  role: string
  jerseyNumber: number | null
  club: { id: string; name: string } | null
  batting: {
    matches: number
    innings: number
    runs: number
    balls: number
    average: number | null
    strikeRate: number
    fifties: number
    hundreds: number
    highestScore: string
    fours: number
    sixes: number
  }
  bowling: {
    matches: number
    overs: string
    ballsBowled: number
    wickets: number
    runsConceded: number
    average: number | null
    economy: number
    strikeRate: number | null
    bestBowling: string
    maidens: number
  }
  fielding: { catches: number; runOuts: number; stumpings: number }
}

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>()
  const { status } = useSession()
  const [range, setRange] = useState<DateRange>({ from: undefined, to: undefined })
  const playersPath = "/players"
  const playersHref = status !== "authenticated" ? `/login?callbackUrl=${encodeURIComponent(playersPath)}` : playersPath

  const statsKey = useMemo(() => {
    const params = new URLSearchParams()
    if (range.from) params.set("from", range.from.toISOString())
    if (range.to) params.set("to", range.to.toISOString())
    const query = params.toString()
    return query ? `players:stats:${id}?${query}` : `players:stats:${id}`
  }, [id, range])

  const statsCache = useCachedData<Stats>(
    statsKey,
    async () => {
      const params = new URLSearchParams()
      if (range.from) params.set("from", range.from.toISOString())
      if (range.to) params.set("to", range.to.toISOString())
      const query = params.toString()
      const response = await fetch(`/api/players/${id}/stats${query ? `?${query}` : ""}`)
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error?.message ?? "Unable to load player statistics")
      return payload as Stats
    },
  )

  const stats = statsCache.data
  const loading = statsCache.isLoading && !stats

  if (loading) return <div className="mx-auto max-w-6xl px-4 py-10"><div className="h-80 animate-pulse rounded-2xl bg-muted" /></div>

  if (!stats) return <div className="mx-auto max-w-3xl px-4 py-10"><Alert variant="destructive"><AlertTitle>Player unavailable</AlertTitle><AlertDescription>{statsCache.error || "Player not found"}</AlertDescription></Alert></div>

  const battingRows = [
    ["Matches", stats.batting.matches],
    ["Innings", stats.batting.innings],
    ["Balls faced", stats.batting.balls],
    ["Average", stats.batting.average ?? "—"],
    ["Strike rate", stats.batting.strikeRate],
    ["Highest score", stats.batting.highestScore],
    ["50s / 100s", `${stats.batting.fifties} / ${stats.batting.hundreds}`],
    ["4s / 6s", `${stats.batting.fours} / ${stats.batting.sixes}`],
  ]
  const bowlingRows = [
    ["Matches", stats.bowling.matches],
    ["Overs", stats.bowling.overs],
    ["Wickets", stats.bowling.wickets],
    ["Runs conceded", stats.bowling.runsConceded],
    ["Average", stats.bowling.average ?? "—"],
    ["Economy", stats.bowling.economy],
    ["Strike rate", stats.bowling.strikeRate ?? "—"],
    ["Best bowling", stats.bowling.bestBowling],
    ["Maidens", stats.bowling.maidens],
  ]

  const rangeActive = Boolean(range.from || range.to)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-9 lg:px-8">
      <ButtonBack href={playersHref} />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary text-xl font-black text-primary-foreground shadow-sm">{stats.jerseyNumber ?? "—"}</div>
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2"><Badge variant="secondary">{stats.role.replaceAll("_", " ")}</Badge>{stats.club && <Badge variant="outline">{stats.club.name}</Badge>}</div>
            <h1 className="text-xl font-bold tracking-tight sm:text-4xl">{stats.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {rangeActive ? "Performance in selected window" : "Player career record"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Card className="min-w-28 border-primary/20 bg-primary/[0.04]"><CardContent className="p-4 text-center"><AnimatedNumber value={stats.batting.runs} className="text-3xl font-black" /><p className="mt-1 text-xs text-muted-foreground">Runs</p></CardContent></Card>
          <Card className="min-w-28 border-primary/20 bg-primary/[0.04]"><CardContent className="p-4 text-center"><AnimatedNumber value={stats.bowling.wickets} className="text-3xl font-black" /><p className="mt-1 text-xs text-muted-foreground">Wickets</p></CardContent></Card>
        </div>
      </div>

      <Card className="mb-4 sm:mb-6">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <TrendingUp className="mt-0.5 size-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold">Date range</p>
              <p className="text-xs text-muted-foreground">
                {rangeActive
                  ? `${range.from ? format(range.from, "dd MMM yyyy") : "Start"} → ${range.to ? format(range.to, "dd MMM yyyy") : "Today"}`
                  : "Showing the full career. Pick a range to analyse form."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker value={range} onChange={setRange} className="w-full sm:w-64" />
            {rangeActive && (
              <Button variant="ghost" size="sm" onClick={() => setRange({ from: undefined, to: undefined })}>
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="size-5" />Batting</CardTitle><CardDescription>Performance with the bat across recorded innings.</CardDescription></CardHeader>
          <CardContent><dl className="divide-y">{battingRows.map(([label, value]) => <div key={String(label)} className="flex items-center justify-between gap-4 py-3"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="font-mono font-semibold">{value}</dd></div>)}</dl></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Award className="size-5" />Bowling</CardTitle><CardDescription>Performance with the ball across recorded spells.</CardDescription></CardHeader>
          <CardContent><dl className="divide-y">{bowlingRows.map(([label, value]) => <div key={String(label)} className="flex items-center justify-between gap-4 py-3"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="font-mono font-semibold">{value}</dd></div>)}</dl></CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="size-5" />Fielding</CardTitle><CardDescription>Disposals recorded in the field.</CardDescription></CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            {[{ label: "Catches", value: stats.fielding.catches }, { label: "Run outs", value: stats.fielding.runOuts }, { label: "Stumpings", value: stats.fielding.stumpings }].map((item) => <div key={item.label} className="rounded-xl border bg-muted/30 p-4 text-center"><p className="text-3xl font-black">{item.value}</p><p className="mt-1 text-xs text-muted-foreground">{item.label}</p></div>)}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ButtonBack({ href }: { href: string }) {
  return <Link href={href} className="mb-5 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Back to players</Link>
}
