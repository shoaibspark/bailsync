import type { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth, requireManager, requireMatchManager, errorResponse, json, parseBody } from "@/lib/api"

const matchSchema = z.object({
  tournamentId: z.string().uuid().optional(),
  homeClubId: z.string().uuid(),
  awayClubId: z.string().uuid(),
  venue: z.string().min(2).optional(),
  scheduledAt: z.string().optional(),
  oversPerInnings: z.number().int().min(1).max(50).optional(),
  maxOversPerBowler: z.number().int().min(1).max(20).optional(),
})

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tournamentId = searchParams.get("tournamentId")
  const matches = await db.match.findMany({
    where: tournamentId ? { tournamentId } : {},
    include: { homeClub: true, awayClub: true, tournament: true, innings: true },
    orderBy: { createdAt: "desc" },
  })
  return json(matches)
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req)
    requireManager(session)
    const body = matchSchema.parse(await parseBody(req))
    if (body.homeClubId === body.awayClubId) {
      return errorResponse(400, "Home and away clubs must be different", "INVALID_TEAMS")
    }
    requireMatchManager(session, { homeClubId: body.homeClubId, awayClubId: body.awayClubId })
    const match = await db.match.create({
      data: {
        tournamentId: body.tournamentId ?? null,
        homeClubId: body.homeClubId,
        awayClubId: body.awayClubId,
        venue: body.venue ?? null,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        oversPerInnings: body.oversPerInnings ?? 20,
        maxOversPerBowler: body.maxOversPerBowler ?? 4,
        status: "SCHEDULED",
        activeScorerId: session.userId,
      },
      include: { homeClub: true, awayClub: true },
    })
    return json(match, 201)
  } catch (e: any) {
    if (e instanceof z.ZodError) return errorResponse(400, "Check the match details and try again", "VALIDATION_ERROR")
    if (e?.status === 401 || e?.status === 403) return errorResponse(e.status, e.message, e.code)
    if (e?.code === "P2003") return errorResponse(404, "One of the selected clubs or tournaments no longer exists", "INVALID_REFERENCE")
    return errorResponse(500, e.message ?? "Unable to create the match", "SERVER_ERROR")
  }
}
