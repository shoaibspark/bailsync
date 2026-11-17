import Link from "next/link"
import { ArrowRight, CalendarDays, MapPin, Plus, Radio, Sparkles, Trophy, UsersRound } from "lucide-react"
import { db } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

async function loadMatches() {
  return db.match.findMany({
    include: { homeClub: true, awayClub: true, tournament: true },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 12,
  })
}

type HomeMatch = Awaited<ReturnType<typeof loadMatches>>[number]

async function loadHomeData() {
  try {
    const [matches, clubCount, tournamentCount] = await Promise.all([
      loadMatches(),
      db.club.count(),
      db.tournament.count(),
    ])
    return { matches, clubCount, tournamentCount }
  } catch {
    return null
  }
}

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "LIVE") return "default"
  if (status === "COMPLETED") return "secondary"
  if (status === "ABANDONED") return "destructive"
  return "outline"
}

function MatchCard({ match, featured = false }: { match: HomeMatch; featured?: boolean }) {
  const isLive = match.status === "LIVE"

  return (
    <Card className={featured ? "group overflow-hidden border-primary/30 shadow-md" : "group transition-all hover:-translate-y-0.5 hover:shadow-md"}>
      <CardHeader className="pb-3">
        <div className="mb-1 flex items-center justify-between gap-3">
          <Badge variant={statusVariant(match.status)}>
            {isLive && <Radio className="size-3 animate-pulse" />}
            {match.status.replace("_", " ")}
          </Badge>
          <span className="text-xs text-muted-foreground">{match.tournament?.name ?? "Friendly match"}</span>
        </div>
        <CardTitle className="text-balance text-xl leading-tight">
          {match.homeClub?.name ?? "Home club"} <span className="text-muted-foreground">vs</span> {match.awayClub?.name ?? "Away club"}
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5"><MapPin />{match.venue || "Venue to be confirmed"}</span>
          <span className="inline-flex items-center gap-1.5"><CalendarDays />{match.oversPerInnings} overs</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4 pt-0">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{match.homeClub?.shortName || "HOME"} vs {match.awayClub?.shortName || "AWAY"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {match.scheduledAt ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(match.scheduledAt)) : "Schedule pending"}
          </p>
        </div>
        <Button asChild variant={featured ? "default" : "ghost"} size="sm" className="shrink-0">
          <Link href={`/matches/${match.id}`}>
            View <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export default async function HomePage() {
  const data = await loadHomeData()

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-3xl font-bold">Bailsync is temporarily unavailable</h1>
        <p className="mt-3 text-muted-foreground">We could not reach the match database. Please refresh in a moment.</p>
      </div>
    )
  }

  const liveMatches = data.matches.filter((match) => match.status === "LIVE")
  const recentMatches = data.matches.filter((match) => match.status !== "LIVE")

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-10 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl border bg-card px-5 py-8 shadow-sm sm:px-8 sm:py-10 lg:px-12 lg:py-12">
        <div className="absolute -right-24 -top-24 size-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 size-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-5 gap-1.5 px-3 py-1">
              <Sparkles /> Built for club cricket
            </Badge>
            <h1 className="text-balance text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Every ball, every over, <span className="text-primary">one live scorecard.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-balance text-base leading-7 text-muted-foreground sm:text-lg">
              Follow live matches, run scoring from any device, and keep tournaments moving even when the connection drops.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-8 w-full text-xs sm:h-9 sm:w-auto sm:text-sm">
                <Link href="/matches">Explore matches <ArrowRight data-icon="inline-end" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-8 w-full text-xs sm:h-9 sm:w-auto sm:text-sm">
                <Link href="/login">Score a match</Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:gap-4 lg:w-80">
            <div className="rounded-2xl border bg-background/80 p-4 text-center backdrop-blur">
              <p className="text-2xl font-black text-primary sm:text-3xl">{liveMatches.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">Live now</p>
            </div>
            <div className="rounded-2xl border bg-background/80 p-4 text-center backdrop-blur">
              <p className="text-2xl font-black sm:text-3xl">{data.clubCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">Clubs</p>
            </div>
            <div className="rounded-2xl border bg-background/80 p-4 text-center backdrop-blur">
              <p className="text-2xl font-black sm:text-3xl">{data.tournamentCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">Events</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Match centre</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight sm:text-3xl">Live action</h2>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/matches">All matches <ArrowRight data-icon="inline-end" /></Link>
          </Button>
        </div>
        {liveMatches.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {liveMatches.map((match) => <MatchCard key={match.id} match={match} featured />)}
          </div>
        ) : (
          <Card className="border-dashed bg-card/60">
            <CardContent className="flex flex-col items-center py-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-muted"><Radio className="text-muted-foreground" /></span>
              <h3 className="mt-4 font-semibold">No live matches right now</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">Follow a completed scorecard or sign in to start scoring the next fixture.</p>
              <Button asChild variant="outline" size="sm" className="mt-4"><Link href="/matches">View match centre</Link></Button>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="mt-10">
        <div className="mb-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Latest results</p>
          <h2 className="mt-1 text-lg font-bold tracking-tight sm:text-3xl">Recent matches</h2>
        </div>
        {recentMatches.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recentMatches.map((match) => <MatchCard key={match.id} match={match} />)}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">No recent matches to show.</CardContent>
          </Card>
        )}
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Trophy /></div>
            <CardTitle className="text-lg">Live scorecards</CardTitle>
            <CardDescription>Follow scores, batters, bowlers, and wicket details in real time.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><UsersRound /></div>
            <CardTitle className="text-lg">Club management</CardTitle>
            <CardDescription>Keep clubs, players, squads, and match officials in one place.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Plus /></div>
            <CardTitle className="text-lg">Tournament ready</CardTitle>
            <CardDescription>Configure formats, create fixtures, and track the competition.</CardDescription>
          </CardHeader>
        </Card>
      </section>
    </div>
  )
}
