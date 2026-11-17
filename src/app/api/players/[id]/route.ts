import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth, requireScorer, errorResponse, json } from "@/lib/api"

const playerSchema = z.object({
  name: z.string().min(1).optional(),
  jerseyNumber: z.number().int().optional(),
  battingStyle: z.string().optional(),
  bowlingStyle: z.string().optional(),
  role: z.enum(["BATTER", "BOWLER", "ALL_ROUNDER", "WICKET_KEEPER"]).optional(),
})

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const player = await db.player.findUnique({ where: { id } })
  if (!player) return errorResponse(404, "Player not found", "NOT_FOUND")
  return json(player)
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
    body = playerSchema.parse(await req.json())
  } catch {
    return errorResponse(400, "Validation error", "VALIDATION_ERROR")
  }
  const player = await db.player.update({ where: { id }, data: body })
  return json(player)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await requireAuth(_req as NextRequest)
  requireScorer(session)
  await db.player.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
