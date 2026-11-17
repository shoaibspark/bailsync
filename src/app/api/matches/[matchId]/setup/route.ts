import type { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth, requireScorer, errorResponse, json, parseBody } from "@/lib/api"

const setupSchema = z.object({
  tossWinnerClubId: z.string().uuid(),
  tossDecision: z.enum(["BAT", "BOWL"]),
  oversPerInnings: z.number().int().min(1).max(50).optional(),
  maxOversPerBowler: z.number().int().min(1).max(20).optional(),
  homePlayerIds: z.array(z.string().uuid()).length(11),
  awayPlayerIds: z.array(z.string().uuid()).length(11),
})

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  try {
    const { matchId } = await params
    const session = await requireAuth(req)
    requireScorer(session)

    const body = setupSchema.parse(await parseBody(req))
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: { innings: { include: { ballEvents: { where: { deletedAt: null } } } } },
    })
    if (!match) return errorResponse(404, "Match not found", "NOT_FOUND")

    if (![match.homeClubId, match.awayClubId].includes(body.tossWinnerClubId)) {
      return errorResponse(400, "The toss winner must be one of the competing clubs", "INVALID_TOSS")
    }

    const selectedIds = [...body.homePlayerIds, ...body.awayPlayerIds]
    if (new Set(selectedIds).size !== selectedIds.length) {
      return errorResponse(400, "A player can only be selected once", "DUPLICATE_PLAYER")
    }

    const players = await db.player.findMany({ where: { id: { in: selectedIds } } })
    if (players.length !== selectedIds.length) {
      return errorResponse(400, "One or more selected players no longer exist", "INVALID_PLAYER")
    }

    const invalidHome = players.filter((player) => body.homePlayerIds.includes(player.id) && player.clubId !== match.homeClubId)
    const invalidAway = players.filter((player) => body.awayPlayerIds.includes(player.id) && player.clubId !== match.awayClubId)
    if (invalidHome.length || invalidAway.length) {
      return errorResponse(400, "Each XI must contain players from its own club", "INVALID_SQUAD")
    }

    const recordedDeliveries = match.innings.reduce((total, innings) => total + innings.ballEvents.length, 0)
    if (recordedDeliveries > 0) {
      return errorResponse(409, "The playing XIs cannot be changed after scoring has started", "MATCH_IN_PROGRESS")
    }

    const battingClubId = body.tossDecision === "BAT"
      ? body.tossWinnerClubId
      : body.tossWinnerClubId === match.homeClubId ? match.awayClubId : match.homeClubId
    const bowlingClubId = battingClubId === match.homeClubId ? match.awayClubId : match.homeClubId

    const result = await db.$transaction(async (tx) => {
      await tx.matchSquad.updateMany({
        where: { matchId, isPlayingXI: true },
        data: { isPlayingXI: false },
      })

      for (const playerId of body.homePlayerIds) {
        await tx.matchSquad.upsert({
          where: { matchId_playerId: { matchId, playerId } },
          update: { isPlayingXI: true },
          create: { matchId, clubId: match.homeClubId, playerId, isPlayingXI: true },
        })
      }
      for (const playerId of body.awayPlayerIds) {
        await tx.matchSquad.upsert({
          where: { matchId_playerId: { matchId, playerId } },
          update: { isPlayingXI: true },
          create: { matchId, clubId: match.awayClubId, playerId, isPlayingXI: true },
        })
      }

      const innings = await tx.innings.upsert({
        where: { matchId_inningsNumber: { matchId, inningsNumber: 1 } },
        update: { battingClubId, bowlingClubId, isCompleted: false },
        create: { matchId, inningsNumber: 1, battingClubId, bowlingClubId },
      })

      const updatedMatch = await tx.match.update({
        where: { id: matchId },
        data: {
          tossWinnerClubId: body.tossWinnerClubId,
          tossDecision: body.tossDecision,
          oversPerInnings: body.oversPerInnings ?? match.oversPerInnings,
          maxOversPerBowler: body.maxOversPerBowler ?? match.maxOversPerBowler,
          status: "LIVE",
          activeScorerId: session.userId,
        },
        include: { homeClub: true, awayClub: true, innings: true },
      })

      return { match: updatedMatch, innings }
    })

    return json(result)
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return errorResponse(400, "Select 11 valid players for each team and complete the toss", "VALIDATION_ERROR")
    }
    if (e?.status === 401 || e?.status === 403) {
      return errorResponse(e.status, e.message, e.code)
    }
    return errorResponse(500, e.message ?? "Unable to set up the match", "SERVER_ERROR")
  }
}
