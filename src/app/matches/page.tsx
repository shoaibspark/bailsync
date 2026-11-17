"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CalendarDays, LoaderCircle, MapPin, Plus, Radio, Trash2, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { apiJson } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { isManager, isSuperadmin } from "@/lib/roles"

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
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<(typeof filters)[number]>("ALL")
  const [deletingId, setDeletingId] = useState("")
  const { session } = useSession()
  const canCreate = isManager(session?.role)
  const ownsClub = (match: Match) => session?.role === "ADMIN" && Boolean(session.clubId) && (match.homeClub?.id === session.clubId || match.awayClub?.id === session.clubId)
  const canDeleteMatch = (match: Match) => isSuperadmin(session?.role) || (ownsClub(match) && match.status === "SCHEDULED")

  useEffect(() => {
    let active = true
    apiJson<Match[]>("/api/matches")
      .then((data) => {
        if (active) setMatches(data)
      })
      .catch((cause: any) => {
        if (active) setError(cause.message ?? "Unable to load matches")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const visibleMatches = useMemo(
    () => filter === "ALL" ? matches : matches.filter((match) => match.status === filter),
    [filter, matches],
  )

  const deleteMatch = async (match: Match) => {
    const label = `${match.homeClub?.name ?? "Home"} vs ${match.awayClub?.name ?? "Away"}`
    if (!window.confirm(`Delete ${label}? This removes the fixture and its recorded deliveries.`)) return
    setDeletingId(match.id)
    setError("")
    try {
      await apiJson(`/api/matches/${match.id}`, { method: "DELETE" })
      setMatches((current) => current.filter((item) => item.id !== match.id))
      router.refresh()
    } catch (cause: any) {
      setError(cause.message ?? "Unable to delete the match")
    } finally {
      setDeletingId("")
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            <Trophy className="size-4" /> Match centre
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Matches</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">Follow every fixture from toss to result, or start a new match.</p>
        </div>
        <Button asChild disabled={!canCreate}>
          <Link href="/matches/new"><Plus />New match</Link>
        </Button>
      </div>

      {!canCreate && !loading && (
        <Alert className="mb-5">
          <AlertTitle>View-only access</AlertTitle>
          <AlertDescription>Club admins and super admins schedule fixtures.</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertTitle>Matches unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter matches">
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={filter === item}
            onClick={() => setFilter(item)}
            className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors ${filter === item ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            {item === "ALL" ? "All matches" : item === "LIVE" ? "Live" : item === "SCHEDULED" ? "Upcoming" : "Completed"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-48 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : visibleMatches.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted"><Radio className="text-muted-foreground" /></span>
            <h2 className="mt-4 font-semibold">No matches in this view</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Try another filter or create the next fixture for your club.</p>
            {canCreate && <Button asChild size="sm" className="mt-4"><Link href="/matches/new"><Plus />Create match</Link></Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleMatches.map((match) => (
            <Card key={match.id} className="group transition-all hover:-translate-y-0.5 hover:shadow-md">
              <Link href={`/matches/${match.id}`} className="flex h-full flex-col">
                <CardContent className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <Badge variant={statusVariant(match.status)}>
                      {match.status === "LIVE" && <Radio className="size-3 animate-pulse" />}
                      {match.status.replace("_", " ")}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{match.tournament?.name ?? "Friendly"}</span>
                  </div>
                  <div className="my-5 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-muted-foreground">{match.homeClub?.shortName || "HOME"}</p>
                      <p className="truncate font-bold">{match.homeClub?.name || "Home club"}</p>
                    </div>
                    <span className="text-xs font-bold uppercase text-muted-foreground">vs</span>
                    <div className="min-w-0 flex-1 text-right">
                      <p className="truncate text-sm text-muted-foreground">{match.awayClub?.shortName || "AWAY"}</p>
                      <p className="truncate font-bold">{match.awayClub?.name || "Away club"}</p>
                    </div>
                  </div>
                  <div className="mt-auto space-y-2 border-t pt-4 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2"><MapPin className="size-4" />{match.venue || "Venue to be confirmed"}</p>
                    <p className="flex items-center gap-2"><CalendarDays className="size-4" />{match.scheduledAt ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(match.scheduledAt)) : "Schedule pending"}</p>
                    {match.resultSummary && <p className="font-semibold text-foreground">{match.resultSummary}</p>}
                  </div>
                </CardContent>
              </Link>
              {canDeleteMatch(match) && (
                <div className="flex justify-end border-t px-5 py-3">
                  <Button variant="destructive" size="sm" onClick={() => deleteMatch(match)} disabled={deletingId === match.id} aria-label={`Delete ${match.homeClub?.name ?? "match"} versus ${match.awayClub?.name ?? "match"}`}>
                    {deletingId === match.id ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                    Delete
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
