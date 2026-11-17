"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { Activity, ArrowRight, Clock3, Radio, Settings2, Trophy } from "lucide-react"
import { useMatchStream } from "@/hooks/use-match-stream"
import { formatStrikeRate, wicketTypeLabel } from "@/lib/cricket-engine/formatters"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { AnimatedNumber } from "@/components/animated-number"
import type { InningsState, MatchState } from "@/lib/cricket-engine/types"

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

export default function MatchPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const { state, connected, reconnecting } = useMatchStream(matchId)
  const innings = state ? currentInnings(state) : null

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <Alert>
          <Activity />
          <AlertTitle>{reconnecting ? "Reconnecting to live score…" : "Loading match centre…"}</AlertTitle>
          <AlertDescription>The live scorecard will appear as soon as the match feed responds.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const recentBalls = innings?.oversTimeline.flatMap((over) => over.balls).slice(-30).reverse() ?? []

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant={connected ? "default" : "secondary"}>
              {connected ? <Radio className="size-3 animate-pulse" /> : <Clock3 className="size-3" />}
              {connected ? "Live" : reconnecting ? "Reconnecting" : "Disconnected"}
            </Badge>
            {state.resultSummary && <Badge variant="outline">{state.resultSummary}</Badge>}
          </div>
          <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            {state.homeClub?.name ?? "Home club"} <span className="text-muted-foreground">vs</span> {state.awayClub?.name ?? "Away club"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {state.matchConfig.oversPerInnings}-over match · {state.matchConfig.maxOversPerBowler} overs per bowler
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link href={`/matches/${matchId}/setup`}><Settings2 />Setup</Link></Button>
          <Button asChild size="sm"><Link href={`/matches/${matchId}/score`}>Scoring console<ArrowRight /></Link></Button>
        </div>
      </div>

      {!innings ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted"><Trophy className="text-muted-foreground" /></span>
            <h2 className="mt-4 font-semibold">The scorecard is ready for setup</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Record the toss, confirm both XIs, and start the first innings to begin scoring.</p>
            <Button asChild className="mt-4"><Link href={`/matches/${matchId}/setup`}>Set up match</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
            <div className="absolute -right-16 -top-20 size-64 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative grid items-end gap-6 lg:grid-cols-[1fr_auto]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Innings {innings.inningsNumber}</p>
                <h2 className="mt-2 text-xl font-bold sm:text-2xl">{innings.battingClubName} batting</h2>
                <div className="mt-4 flex items-baseline gap-2 font-mono font-black tracking-tight" aria-label={`${innings.totalRuns} runs for ${innings.wickets} wickets`}>
                  <AnimatedNumber value={innings.totalRuns} className="text-6xl sm:text-7xl" />
                  <span className="text-3xl text-muted-foreground sm:text-4xl">/</span>
                  <AnimatedNumber value={innings.wickets} className="text-5xl sm:text-6xl" />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                  <span>{innings.overs} overs</span>
                  <span>CRR {innings.crr}</span>
                  {innings.targetRuns !== undefined && <span className="font-semibold text-foreground">Target {innings.targetRuns}</span>}
                  {innings.runsRemaining > 0 && <span>{innings.runsRemaining} runs needed</span>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:flex">
                <div className="min-w-32 rounded-xl border bg-background/70 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Striker</p>
                  <p className="mt-1 truncate font-bold">{innings.batters.find((batter) => batter.isOnStrike)?.name ?? "—"}</p>
                </div>
                <div className="min-w-32 rounded-xl border bg-background/70 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Bowler</p>
                  <p className="mt-1 truncate font-bold">{innings.bowlers.find((bowler) => bowler.isCurrent)?.name ?? "—"}</p>
                </div>
              </div>
            </div>
          </section>

          {(state.innings1 || state.innings2) && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[state.innings1, state.innings2].map((item, index) => item && (
                <Card key={item.inningsId} className={item.inningsNumber === innings.inningsNumber ? "border-primary/30" : ""}>
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div>
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
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="scorecard" className="h-10">Scorecard</TabsTrigger>
              <TabsTrigger value="commentary" className="h-10">Commentary</TabsTrigger>
            </TabsList>

            <TabsContent value="scorecard" className="mt-5">
              <div className="grid items-start gap-5 lg:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>Batting</CardTitle><CardDescription>{innings.battingClubName}</CardDescription></CardHeader>
                  <CardContent className="px-0 sm:px-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Batter</TableHead>
                          <TableHead className="text-right">R</TableHead>
                          <TableHead className="text-right">B</TableHead>
                          <TableHead className="text-right">4</TableHead>
                          <TableHead className="text-right">6</TableHead>
                          <TableHead className="text-right">SR</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {innings.batters.map((batter) => (
                          <TableRow key={batter.playerId} className={batter.isOnStrike ? "bg-primary/[0.04]" : ""}>
                            <TableCell className="max-w-40 whitespace-normal font-medium">
                              {batter.name}
                              {batter.isOnStrike && <span className="ml-2 text-xs text-primary">●</span>}
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
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Bowling</CardTitle><CardDescription>{innings.bowlingClubName}</CardDescription></CardHeader>
                  <CardContent className="px-0 sm:px-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Bowler</TableHead>
                          <TableHead className="text-right">O</TableHead>
                          <TableHead className="text-right">M</TableHead>
                          <TableHead className="text-right">R</TableHead>
                          <TableHead className="text-right">W</TableHead>
                          <TableHead className="text-right">Econ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {innings.bowlers.map((bowler) => (
                          <TableRow key={bowler.playerId} className={bowler.isCurrent ? "bg-primary/[0.04]" : ""}>
                            <TableCell className="font-medium">{bowler.name}</TableCell>
                            <TableCell className="text-right">{bowler.overs}</TableCell>
                            <TableCell className="text-right">{bowler.maidens}</TableCell>
                            <TableCell className="text-right">{bowler.runsConceded}</TableCell>
                            <TableCell className="text-right font-semibold">{bowler.wickets}</TableCell>
                            <TableCell className="text-right">{bowler.economy}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="commentary" className="mt-5">
              <Card>
                <CardHeader><CardTitle>Recent deliveries</CardTitle><CardDescription>Latest activity from the current innings.</CardDescription></CardHeader>
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
