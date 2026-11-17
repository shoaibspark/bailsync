import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import {
  requireAuth,
  requireClubManager,
  errorResponse,
  json,
  parseBody,
} from "@/lib/api"

const playerSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  jerseyNumber: z.number().int().min(0).max(99).nullable().optional(),
  battingStyle: z.string().max(80).nullable().optional(),
  bowlingStyle: z.string().max(80).nullable().optional(),
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
  try {
    const { id } = await params
    const session = await requireAuth(req)
    const existing = await db.player.findUnique({ where: { id } })
    if (!existing) return errorResponse(404, "Player not found", "NOT_FOUND")
    requireClubManager(session, existing.clubId)
    const body = playerSchema.parse(await parseBody(req))
    const player = await db.player.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.jerseyNumber !== undefined ? { jerseyNumber: body.jerseyNumber } : {}),
        ...(body.battingStyle !== undefined ? { battingStyle: body.battingStyle } : {}),
        ...(body.bowlingStyle !== undefined ? { bowlingStyle: body.bowlingStyle } : {}),
        ...(body.role !== undefined ? { role: body.role } : {}),
      },
    })
    return json(player)
  } catch (e: any) {
    if (e instanceof z.ZodError) return errorResponse(400, "Check the player details and try again", "VALIDATION_ERROR")
    if (e?.status === 401 || e?.status === 403) return errorResponse(e.status, e.message, e.code)
    if (e?.code === "P2002") return errorResponse(409, "This player is already registered for the club", "PLAYER_EXISTS")
    if (e?.code === "P2025") return errorResponse(404, "Player not found", "NOT_FOUND")
    return errorResponse(500, e.message ?? "Unable to update the player", "SERVER_ERROR")
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const session = await requireAuth(req)
    const existing = await db.player.findUnique({ where: { id } })
    if (!existing) return errorResponse(404, "Player not found", "NOT_FOUND")
    requireClubManager(session, existing.clubId)
    await db.player.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e?.status === 401 || e?.status === 403) return errorResponse(e.status, e.message, e.code)
    if (e?.code === "P2025") return errorResponse(404, "Player not found", "NOT_FOUND")
    return errorResponse(500, e.message ?? "Unable to delete the player", "SERVER_ERROR")
  }
}
