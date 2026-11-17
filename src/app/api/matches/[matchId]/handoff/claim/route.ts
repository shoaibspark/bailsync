import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { sseHub } from "@/lib/realtime/sse-hub"
import { requireAuth, requireScorer, errorResponse } from "@/lib/api"

const claimSchema = z.object({
  code: z.string().length(6),
})

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { matchId } = await params
  const session = await requireAuth(req)
  requireScorer(session)

  let body: any
  try {
    body = claimSchema.parse(await req.json())
  } catch {
    return errorResponse(400, "Validation error", "VALIDATION_ERROR")
  }

  try {
    const match = await db.match.findUnique({ where: { id: matchId } })
    if (!match) {
      return errorResponse(404, "Match not found", "NOT_FOUND")
    }
    if (
      !match.scorerHandoffCode ||
      match.scorerHandoffCode !== body.code ||
      !match.handoffExpiresAt ||
      match.handoffExpiresAt < new Date()
    ) {
      return errorResponse(401, "Invalid or expired handoff code", "INVALID_CODE")
    }

    const updated = await db.match.update({
      where: { id: matchId },
      data: {
        activeScorerId: session.userId,
        scorerHandoffCode: null,
        handoffExpiresAt: null,
      },
    })

    sseHub.publish(matchId, { event: "handoff", activeScorerId: session.userId })

    return NextResponse.json({
      ok: true,
      activeScorerId: updated.activeScorerId,
    })
  } catch (e: any) {
    return errorResponse(500, e.message ?? "Handoff claim failed", "SERVER_ERROR")
  }
}
