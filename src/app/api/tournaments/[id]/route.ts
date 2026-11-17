import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth, requireScorer, errorResponse, json } from "@/lib/api"

const tournamentSchema = z.object({
  name: z.string().min(1).optional(),
  format: z.enum(["LEAGUE", "KNOCKOUT", "GROUP_KNOCKOUT"]).optional(),
  oversPerInnings: z.number().int().optional(),
  maxOversPerBowler: z.number().int().optional(),
  ballsPerOver: z.number().int().optional(),
  wideRuns: z.number().int().optional(),
  noBallRuns: z.number().int().optional(),
  lastManStands: z.boolean().optional(),
  pointsWin: z.number().int().optional(),
  pointsTie: z.number().int().optional(),
  pointsNoResult: z.number().int().optional(),
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
  const { id } = await params
  const session = await requireAuth(req)
  requireScorer(session)
  let body: any
  try {
    body = tournamentSchema.parse(await req.json())
  } catch {
    return errorResponse(400, "Validation error", "VALIDATION_ERROR")
  }
  const t = await db.tournament.update({ where: { id }, data: body })
  return json(t)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await requireAuth(_req as NextRequest)
  requireScorer(session)
  await db.tournament.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
