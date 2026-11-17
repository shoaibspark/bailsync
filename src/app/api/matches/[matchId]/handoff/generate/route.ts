import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { db } from "@/lib/db"
import { requireAuth, requireScorer, errorResponse } from "@/lib/api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { matchId } = await params
  const session = await requireAuth(req)
  requireScorer(session)

  try {
    const match = await db.match.findUnique({ where: { id: matchId } })
    if (!match) {
      return errorResponse(404, "Match not found", "NOT_FOUND")
    }

    const code = crypto.randomInt(100000, 999999).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 min

    const updated = await db.match.update({
      where: { id: matchId },
      data: {
        scorerHandoffCode: code,
        handoffExpiresAt: expiresAt,
        activeScorerId: session.userId,
      },
    })

    return NextResponse.json({
      code,
      expiresAt,
      activeScorerId: updated.activeScorerId,
    })
  } catch (e: any) {
    return errorResponse(500, e.message ?? "Handoff generate failed", "SERVER_ERROR")
  }
}
