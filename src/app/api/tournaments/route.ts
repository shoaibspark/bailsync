import type { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth, requireManager, errorResponse, json, parseBody } from "@/lib/api"

const tournamentSchema = z.object({
  name: z.string().min(2).max(120),
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

export async function GET() {
  const tournaments = await db.tournament.findMany({ orderBy: { name: "asc" } })
  return json(tournaments)
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req)
    requireManager(session)
    const body = tournamentSchema.parse(await parseBody(req))
    const tournament = await db.tournament.create({
      data: { ...body, managerId: session.userId },
    })
    return json(tournament, 201)
  } catch (e: any) {
    if (e instanceof z.ZodError) return errorResponse(400, "Check the tournament rules and try again", "VALIDATION_ERROR")
    if (e?.status === 401 || e?.status === 403) return errorResponse(e.status, e.message, e.code)
    if (e?.code === "P2002") return errorResponse(409, "A tournament with this name already exists", "TOURNAMENT_EXISTS")
    return errorResponse(500, e.message ?? "Unable to create the tournament", "SERVER_ERROR")
  }
}
