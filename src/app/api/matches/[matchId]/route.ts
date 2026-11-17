import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import {
  requireAuth,
  requireMatchManager,
  errorResponse,
  json,
  parseBody,
} from "@/lib/api"
import { isSuperadmin } from "@/lib/roles"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { matchId } = await params
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: { homeClub: true, awayClub: true, innings: true, squads: { include: { player: true } } },
  })
  if (!match) return errorResponse(404, "Match not found", "NOT_FOUND")
  return json(match)
}

const updateSchema = z.object({
  status: z.enum(["SCHEDULED", "LIVE", "INNINGS_BREAK", "COMPLETED", "ABANDONED"]).optional(),
  tossWinnerClubId: z.string().uuid().nullable().optional(),
  tossDecision: z.enum(["BAT", "BOWL"]).nullable().optional(),
  resultSummary: z.string().max(200).nullable().optional(),
  resultType: z.enum(["WIN_RUNS", "WIN_WICKETS", "TIE", "NO_RESULT", "ABANDONED"]).nullable().optional(),
  winnerClubId: z.string().uuid().nullable().optional(),
  tournamentId: z.string().uuid().nullable().optional(),
  homeClubId: z.string().uuid().optional(),
  awayClubId: z.string().uuid().optional(),
  venue: z.string().max(160).nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  oversPerInnings: z.number().int().min(1).max(50).optional(),
  maxOversPerBowler: z.number().int().min(1).max(20).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  try {
    const { matchId } = await params
    const session = await requireAuth(req)
    const existing = await db.match.findUnique({
      where: { id: matchId },
      include: { innings: { include: { ballEvents: { where: { deletedAt: null } } } } },
    })
    if (!existing) return errorResponse(404, "Match not found", "NOT_FOUND")
    requireMatchManager(session, existing)

    const body = updateSchema.parse(await parseBody(req))
    if (body.homeClubId && body.homeClubId === body.awayClubId) {
      return errorResponse(400, "Home and away clubs must be different", "INVALID_TEAMS")
    }
    if (body.tossWinnerClubId) {
      const clubIds = [body.homeClubId ?? existing.homeClubId, body.awayClubId ?? existing.awayClubId]
      if (!clubIds.includes(body.tossWinnerClubId)) {
        return errorResponse(400, "The toss winner must be one of the competing clubs", "INVALID_TOSS")
      }
    }

    const recordedDeliveries = existing.innings.reduce((total, innings) => total + innings.ballEvents.length, 0)
    const changesStructure =
      body.homeClubId !== undefined ||
      body.awayClubId !== undefined ||
      body.oversPerInnings !== undefined ||
      body.maxOversPerBowler !== undefined
    if (changesStructure && recordedDeliveries > 0 && !isSuperadmin(session.role)) {
      return errorResponse(403, "Only a super admin can change teams or limits after scoring has started", "FORBIDDEN")
    }

    const match = await db.match.update({
      where: { id: matchId },
      data: {
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.tossWinnerClubId !== undefined ? { tossWinnerClubId: body.tossWinnerClubId } : {}),
        ...(body.tossDecision !== undefined ? { tossDecision: body.tossDecision } : {}),
        ...(body.resultSummary !== undefined ? { resultSummary: body.resultSummary } : {}),
        ...(body.resultType !== undefined ? { resultType: body.resultType } : {}),
        ...(body.winnerClubId !== undefined ? { winnerClubId: body.winnerClubId } : {}),
        ...(body.tournamentId !== undefined ? { tournamentId: body.tournamentId } : {}),
        ...(body.homeClubId !== undefined ? { homeClubId: body.homeClubId } : {}),
        ...(body.awayClubId !== undefined ? { awayClubId: body.awayClubId } : {}),
        ...(body.venue !== undefined ? { venue: body.venue } : {}),
        ...(body.scheduledAt !== undefined ? { scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null } : {}),
        ...(body.oversPerInnings !== undefined ? { oversPerInnings: body.oversPerInnings } : {}),
        ...(body.maxOversPerBowler !== undefined ? { maxOversPerBowler: body.maxOversPerBowler } : {}),
      },
    })
    return json(match)
  } catch (e: any) {
    if (e instanceof z.ZodError) return errorResponse(400, "Check the match details and try again", "VALIDATION_ERROR")
    if (e?.status === 401 || e?.status === 403) return errorResponse(e.status, e.message, e.code)
    if (e?.code === "P2025") return errorResponse(404, "Match not found", "NOT_FOUND")
    return errorResponse(500, e.message ?? "Unable to update the match", "SERVER_ERROR")
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  try {
    const { matchId } = await params
    const session = await requireAuth(req)
    const existing = await db.match.findUnique({ where: { id: matchId } })
    if (!existing) return errorResponse(404, "Match not found", "NOT_FOUND")
    requireMatchManager(session, existing)
    if (!isSuperadmin(session.role) && existing.status !== "SCHEDULED") {
      return errorResponse(409, "Only scheduled fixtures can be deleted by a club admin", "MATCH_IN_PROGRESS")
    }
    await db.match.delete({ where: { id: matchId } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e?.status === 401 || e?.status === 403) return errorResponse(e.status, e.message, e.code)
    if (e?.code === "P2025") return errorResponse(404, "Match not found", "NOT_FOUND")
    return errorResponse(500, e.message ?? "Unable to delete the match", "SERVER_ERROR")
  }
}
