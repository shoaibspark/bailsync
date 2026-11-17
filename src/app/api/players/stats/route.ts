import type { NextRequest } from "next/server"
import { db } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bowlerWicketTypes = new Set(["BOWLED", "CAUGHT", "LBW", "STUMPED", "HIT_WICKET"])

export type PlayerRangeStat = {
  playerId: string
  runs: number
  balls: number
  wickets: number
  runsConceded: number
  ballsBowled: number
}

/**
 * Aggregated player performance for every player that appears in a ball event
 * inside the requested match date range.
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const fromParam = searchParams.get("from")
  const toParam = searchParams.get("to")
  const from = fromParam ? new Date(fromParam) : null
  const to = toParam ? new Date(toParam) : null
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    return Response.json({ error: { message: "Invalid date range", code: "VALIDATION_ERROR" } }, { status: 400 })
  }

  const events = await db.ballEvent.findMany({
    where: {
      deletedAt: null,
      ...(from || to
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
    select: {
      strikerId: true,
      bowlerId: true,
      runsScored: true,
      extraType: true,
      isWicket: true,
      wicketType: true,
    },
  })

  const stats = new Map<string, PlayerRangeStat>()
  const ensure = (playerId: string) => {
    let entry = stats.get(playerId)
    if (!entry) {
      entry = { playerId, runs: 0, balls: 0, wickets: 0, runsConceded: 0, ballsBowled: 0 }
      stats.set(playerId, entry)
    }
    return entry
  }

  for (const event of events) {
    const batting = ensure(event.strikerId)
    batting.runs += event.runsScored
    if (event.extraType === "NONE" || event.extraType === "NO_BALL") batting.balls += 1

    const bowling = ensure(event.bowlerId)
    if (event.extraType === "NONE" || event.extraType === "BYE" || event.extraType === "LEG_BYE") {
      bowling.ballsBowled += 1
    }
    if (event.extraType === "NONE") bowling.runsConceded += event.runsScored
    if (event.extraType === "NO_BALL") bowling.runsConceded += event.runsScored + 1
    if (event.extraType === "WIDE") bowling.runsConceded += 1
    if (event.isWicket && event.wicketType && bowlerWicketTypes.has(event.wicketType)) bowling.wickets += 1
  }

  return Response.json({
    from: from?.toISOString() ?? null,
    to: to?.toISOString() ?? null,
    stats: Array.from(stats.values()),
  })
}
