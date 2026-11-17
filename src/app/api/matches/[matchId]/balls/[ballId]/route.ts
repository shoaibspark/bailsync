import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { sseHub } from "@/lib/realtime/sse-hub"
import { computeInningsState } from "@/lib/cricket-engine/reducer"
import { encodeBody } from "@/lib/wire-codec"
import { requireAuth, requireScorer, errorResponse } from "@/lib/api"

const editSchema = z.object({
  runsScored: z.number().int().min(0).optional(),
  extraType: z.enum(["NONE", "WIDE", "NO_BALL", "BYE", "LEG_BYE", "PENALTY"]).optional(),
  extraRuns: z.number().int().min(0).optional(),
  isWicket: z.boolean().optional(),
  wicketType: z.enum(["BOWLED", "CAUGHT", "LBW", "RUN_OUT", "STUMPED", "HIT_WICKET", "RETIRED_HURT", "RETIRED_OUT", "OBSTRUCTING_FIELD", "TIMED_OUT"]).optional(),
  dismissedPlayerId: z.string().nullable().optional(),
  fielderId: z.string().nullable().optional(),
  incomingBatterId: z.string().nullable().optional(),
  commentaryText: z.string().optional(),
})

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string; ballId: string }> },
) {
  const { ballId } = await params
  const session = await requireAuth(req)
  requireScorer(session)

  let body: any
  try {
    body = editSchema.parse(await req.json())
  } catch {
    return errorResponse(400, "Validation error", "VALIDATION_ERROR")
  }

  try {
    const existing = await db.ballEvent.findUnique({ where: { id: ballId } })
    if (!existing) {
      return errorResponse(404, "Ball not found", "NOT_FOUND")
    }

    const updated = await db.ballEvent.update({
      where: { id: ballId },
      data: {
        ...(body.runsScored !== undefined ? { runsScored: body.runsScored } : {}),
        ...(body.extraType !== undefined ? { extraType: body.extraType } : {}),
        ...(body.extraRuns !== undefined ? { extraRuns: body.extraRuns } : {}),
        ...(body.isWicket !== undefined ? { isWicket: body.isWicket } : {}),
        ...(body.wicketType !== undefined ? { wicketType: body.wicketType } : {}),
        ...(body.dismissedPlayerId !== undefined ? { dismissedPlayerId: body.dismissedPlayerId } : {}),
        ...(body.fielderId !== undefined ? { fielderId: body.fielderId } : {}),
        ...(body.incomingBatterId !== undefined ? { incomingBatterId: body.incomingBatterId } : {}),
        ...(body.commentaryText !== undefined ? { commentaryText: body.commentaryText } : {}),
      },
    })

    // recompute innings state
    const innings = await db.innings.findUnique({
      where: { id: existing.inningsId },
      include: { ballEvents: { where: { deletedAt: null }, orderBy: { sequenceNumber: "asc" } } },
    })
    if (innings) {
      const match = await db.match.findUnique({ where: { id: innings.matchId } })
      const config = {
        oversPerInnings: match?.oversPerInnings ?? 20,
        maxOversPerBowler: match?.maxOversPerBowler ?? 4,
        ballsPerOver: 6,
        wideRuns: 1,
        noBallRuns: 1,
        lastManStands: false,
      }
      const state = computeInningsState(
        config,
        {
          inningsNumber: innings.inningsNumber,
          battingClubId: innings.battingClubId,
          bowlingClubId: innings.bowlingClubId,
          targetRuns: innings.targetRuns ?? undefined,
          playingXI: [],
        },
        innings.ballEvents.map((e: any) => ({
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
      )
      sseHub.publish(innings.matchId, state)
    }

    const enc = encodeBody({ ok: true, ball: updated })
    return new Response(enc.body as string, {
      status: 200,
      headers: { "Content-Type": enc.contentType },
    })
  } catch (e: any) {
    return errorResponse(500, e.message ?? "Failed to edit ball", "SERVER_ERROR")
  }
}
