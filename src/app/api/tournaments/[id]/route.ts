import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import {
  requireAuth,
  requireTournamentManager,
  errorResponse,
  json,
  parseBody,
} from "@/lib/api"

const tournamentSchema = z.object({
  name: z.string().min(1).optional(),
  format: z.enum(["LEAGUE", "KNOCKOUT", "GROUP_KNOCKOUT"]).optional(),
  oversPerInnings: z.number().int().min(1).max(50).optional(),
  maxOversPerBowler: z.number().int().min(1).max(20).optional(),
  ballsPerOver: z.number().int().min(1).max(12).optional(),
  wideRuns: z.number().int().min(0).max(10).optional(),
  noBallRuns: z.number().int().min(0).max(10).optional(),
  lastManStands: z.boolean().optional(),
  pointsWin: z.number().int().min(0).max(10).optional(),
  pointsTie: z.number().int().min(0).max(10).optional(),
  pointsNoResult: z.number().int().min(0).max(10).optional(),
})

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const t = await db.tournament.findUnique({ where: { id } })
  if (!t) return errorResponse(404, "Tournament not found", "NOT_FOUND")
  return json(t)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const session = await requireAuth(req)
    const existing = await db.tournament.findUnique({ where: { id } })
    if (!existing) return errorResponse(404, "Tournament not found", "NOT_FOUND")
    requireTournamentManager(session, existing)
    const body = tournamentSchema.parse(await parseBody(req))
    const t = await db.tournament.update({ where: { id }, data: body })
    return json(t)
  } catch (e: any) {
    if (e instanceof z.ZodError) return errorResponse(400, "Check the tournament rules and try again", "VALIDATION_ERROR")
    if (e?.status === 401 || e?.status === 403) return errorResponse(e.status, e.message, e.code)
    if (e?.code === "P2002") return errorResponse(409, "A tournament with this name already exists", "TOURNAMENT_EXISTS")
    if (e?.code === "P2025") return errorResponse(404, "Tournament not found", "NOT_FOUND")
    return errorResponse(500, e.message ?? "Unable to update the tournament", "SERVER_ERROR")
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const session = await requireAuth(req)
    const existing = await db.tournament.findUnique({ where: { id } })
    if (!existing) return errorResponse(404, "Tournament not found", "NOT_FOUND")
    requireTournamentManager(session, existing)
    await db.tournament.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e?.status === 401 || e?.status === 403) return errorResponse(e.status, e.message, e.code)
    if (e?.code === "P2025") return errorResponse(404, "Tournament not found", "NOT_FOUND")
    return errorResponse(500, e.message ?? "Unable to delete the tournament", "SERVER_ERROR")
  }
}
