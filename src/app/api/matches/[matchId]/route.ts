import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth, requireScorer, errorResponse, json } from "@/lib/api"

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
  tossWinnerClubId: z.string().optional(),
  tossDecision: z.enum(["BAT", "BOWL"]).optional(),
  resultSummary: z.string().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { matchId } = await params
  const session = await requireAuth(req)
  requireScorer(session)
  let body: any
  try {
    body = updateSchema.parse(await req.json())
  } catch {
    return errorResponse(400, "Validation error", "VALIDATION_ERROR")
  }
  const match = await db.match.update({ where: { id: matchId }, data: body })
  return json(match)
}
