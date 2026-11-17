import type { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth, requireManager, requireClubManager, errorResponse, json, parseBody } from "@/lib/api"

const playerSchema = z.object({
  clubId: z.string().uuid(),
  name: z.string().min(2).max(80),
  jerseyNumber: z.number().int().min(0).max(99).optional(),
  battingStyle: z.string().optional(),
  bowlingStyle: z.string().optional(),
  role: z.enum(["BATTER", "BOWLER", "ALL_ROUNDER", "WICKET_KEEPER"]).optional(),
})

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const clubId = searchParams.get("clubId")
  const players = await db.player.findMany({
    where: clubId ? { clubId } : {},
    include: { club: { select: { id: true, name: true } } },
    orderBy: [{ club: { name: "asc" } }, { name: "asc" }],
  })
  return json(players)
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req)
    requireManager(session)
    const body = playerSchema.parse(await parseBody(req))
    requireClubManager(session, body.clubId)
    const player = await db.player.create({ data: body })
    return json(player, 201)
  } catch (e: any) {
    if (e instanceof z.ZodError) return errorResponse(400, "Check the player details and try again", "VALIDATION_ERROR")
    if (e?.status === 401 || e?.status === 403) return errorResponse(e.status, e.message, e.code)
    if (e?.code === "P2003") return errorResponse(404, "That club no longer exists", "CLUB_NOT_FOUND")
    if (e?.code === "P2002") return errorResponse(409, "This player is already registered for the club", "PLAYER_EXISTS")
    return errorResponse(500, e.message ?? "Unable to add the player", "SERVER_ERROR")
  }
}
