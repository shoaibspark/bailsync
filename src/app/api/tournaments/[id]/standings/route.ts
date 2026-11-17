import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { computeMatchState } from "@/lib/cricket-engine/reducer"
import { computeStandings } from "@/lib/tournament/standings"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const tournament = await db.tournament.findUnique({ where: { id } })
  if (!tournament) {
    return new Response(JSON.stringify({ error: "Tournament not found" }), { status: 404 })
  }

  const matches = await db.match.findMany({
    where: { tournamentId: id },
    include: {
      innings: {
        orderBy: { inningsNumber: "asc" },
        include: { ballEvents: { where: { deletedAt: null }, orderBy: { sequenceNumber: "asc" } } },
      },
    },
  })

  const clubs = await db.club.findMany()

  const config = {
    oversPerInnings: tournament.oversPerInnings,
    maxOversPerBowler: tournament.maxOversPerBowler,
    ballsPerOver: tournament.ballsPerOver,
    wideRuns: tournament.wideRuns,
    noBallRuns: tournament.noBallRuns,
    lastManStands: tournament.lastManStands,
  }

  const input = {
    clubs: clubs.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })),
    matches: matches.map((m: any) => {
      const inningsList = m.innings.map((inn: any) => {
        const squads = [] // playingXI not loaded; derive from batters/bowlers present
        const playingXI = Array.from(new Set(
          inn.ballEvents.map((e: any) => e.strikerId).concat(inn.ballEvents.map((e: any) => e.bowlerId)),
        ))
        return {
          inningsNumber: inn.inningsNumber,
          matchId: m.id,
          battingClubId: inn.battingClubId,
          bowlingClubId: inn.bowlingClubId,
          targetRuns: inn.targetRuns ?? undefined,
          playingXI,
          events: inn.ballEvents.map((e: any) => ({
            sequenceNumber: e.sequenceNumber,
            strikerId: e.strikerId,
            nonStrikerId: e.nonStrikerId,
            bowlerId: e.bowlerId,
            runsScored: e.runsScored,
            extraType: e.extraType,
            extraRuns: e.extraRuns,
            isWicket: e.isWicket,
            wicketType: e.wicketType,
            dismissedPlayerId: e.dismissedPlayerId,
            fielderId: e.fielderId,
            incomingBatterId: e.incomingBatterId,
            deletedAt: e.deletedAt,
          })),
          isSuperOver: inn.inningsNumber > 2,
        }
      })
      const state = computeMatchState(m.id, inningsList, config)
      return {
        id: m.id,
        status: m.status,
        resultType: state.resultType ?? null,
        resultSummary: state.resultSummary ?? null,
        winnerClubId: state.winnerClubId,
        oversPerInnings: m.oversPerInnings,
        innings: inningsList.map((inn: any) => {
          const st = state.innings1?.inningsNumber === inn.inningsNumber ? state.innings1 :
            state.innings2?.inningsNumber === inn.inningsNumber ? state.innings2 :
            state.superOver1?.inningsNumber === inn.inningsNumber ? state.superOver1 :
            state.superOver2
          return {
            battingClubId: inn.battingClubId,
            bowlingClubId: inn.bowlingClubId,
            runs: st?.totalRuns ?? 0,
            wickets: st?.wickets ?? 0,
            legalBalls: st?.legalBalls ?? 0,
            oversBowledByBowling: 0,
            isAllOut: st?.completionReason === "all_out",
            targetChased: !!st?.targetChased,
            completed: !!st?.isCompleted,
          }
        }),
      }
    }),
  }

  const standings = computeStandings(input)
  return NextResponse.json(standings)
}
