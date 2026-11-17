import type { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { aggregatePlayerStats } from "@/lib/stats/player"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bowlerWicketTypes = new Set(["BOWLED", "CAUGHT", "LBW", "STUMPED", "HIT_WICKET"])

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const searchParams = req.nextUrl.searchParams
  const fromParam = searchParams.get("from")
  const toParam = searchParams.get("to")
  const from = fromParam ? new Date(fromParam) : null
  const to = toParam ? new Date(toParam) : null
  const hasRange = Boolean(from || to)
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    return Response.json({ error: { message: "Invalid date range", code: "VALIDATION_ERROR" } }, { status: 400 })
  }

  const player = await db.player.findUnique({
    where: { id },
    include: { club: { select: { id: true, name: true } } },
  })
  if (!player) return Response.json({ error: { message: "Player not found", code: "NOT_FOUND" } }, { status: 404 })

  const events = await db.ballEvent.findMany({
    where: {
      OR: [
        { strikerId: id },
        { nonStrikerId: id },
        { bowlerId: id },
        { dismissedPlayerId: id },
        { fielderId: id },
      ],
      deletedAt: null,
      ...(hasRange
        ? {
            innings: {
              match: {
                scheduledAt: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {}),
                },
              },
            },
          }
        : {}),
    },
    include: { innings: { select: { id: true, matchId: true } } },
    orderBy: { sequenceNumber: "asc" },
  })

  type InningsEntry = {
    matchId: string
    batting: Array<{ playerId: string; runs: number; balls: number; fours: number; sixes: number; isOut: boolean }>
    bowling: Array<{ playerId: string; legalBalls: number; runsConceded: number; wickets: number; maidens: number }>
    fielding: { catches: number; runOuts: number; stumpings: number }
  }

  const inningsMap = new Map<string, InningsEntry>()
  for (const event of events) {
    let entry = inningsMap.get(event.inningsId)
    if (!entry) {
      entry = {
        matchId: event.innings.matchId,
        batting: [],
        bowling: [],
        fielding: { catches: 0, runOuts: 0, stumpings: 0 },
      }
      inningsMap.set(event.inningsId, entry)
    }

    if (event.strikerId === id || event.dismissedPlayerId === id) {
      let batting = entry.batting[0]
      if (!batting) {
        batting = { playerId: id, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false }
        entry.batting.push(batting)
      }
      if (event.strikerId === id) {
        batting.runs += event.runsScored
        if (event.extraType === "NONE" || event.extraType === "NO_BALL") batting.balls += 1
        if (event.runsScored === 4) batting.fours += 1
        if (event.runsScored === 6) batting.sixes += 1
      }
      if (event.dismissedPlayerId === id) batting.isOut = true
    }

    if (event.bowlerId === id) {
      let bowling = entry.bowling[0]
      if (!bowling) {
        bowling = { playerId: id, legalBalls: 0, runsConceded: 0, wickets: 0, maidens: 0 }
        entry.bowling.push(bowling)
      }
      if (event.extraType === "NONE" || event.extraType === "BYE" || event.extraType === "LEG_BYE") {
        bowling.legalBalls += 1
      }
      if (event.extraType === "NONE") bowling.runsConceded += event.runsScored
      if (event.extraType === "NO_BALL") bowling.runsConceded += event.runsScored + 1
      if (event.extraType === "WIDE") bowling.runsConceded += 1
      if (event.isWicket && event.wicketType && bowlerWicketTypes.has(event.wicketType)) bowling.wickets += 1
    }

    if (event.fielderId === id) {
      if (event.wicketType === "CAUGHT") entry.fielding.catches += 1
      if (event.wicketType === "RUN_OUT") entry.fielding.runOuts += 1
      if (event.wicketType === "STUMPED") entry.fielding.stumpings += 1
    }
  }

  const stats = aggregatePlayerStats(id, player.name, [...inningsMap.values()])
  return Response.json({
    ...stats,
    playerId: player.id,
    club: player.club,
    role: player.role,
    jerseyNumber: player.jerseyNumber,
    range: hasRange ? { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null } : null,
  })
}
