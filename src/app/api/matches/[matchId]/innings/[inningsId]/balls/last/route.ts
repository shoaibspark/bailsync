import type { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { sseHub } from "@/lib/realtime/sse-hub"
import { getMatchStateSnapshot } from "@/lib/cricket-engine/match-state"
import { requireAuth, requireScorer, json, errorResponse } from "@/lib/api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string; inningsId: string }> },
) {
  try {
    const { matchId, inningsId } = await params
    const session = await requireAuth(req)
    requireScorer(session)

    const innings = await db.innings.findUnique({ where: { id: inningsId } })
    if (!innings || innings.matchId !== matchId) {
      return errorResponse(404, "Innings not found", "NOT_FOUND")
    }

    const last = await db.ballEvent.findFirst({
      where: { inningsId, deletedAt: null },
      orderBy: { sequenceNumber: "desc" },
    })
    if (!last) return errorResponse(404, "No delivery to undo", "NOT_FOUND")

    await db.ballEvent.update({
      where: { id: last.id },
      data: { deletedAt: new Date() },
    })

    const state = await getMatchStateSnapshot(matchId)
    if (state) sseHub.publish(matchId, state)

    return json({ ok: true, undone: last.id })
  } catch (e: any) {
    if (e?.status === 401 || e?.status === 403) {
      return errorResponse(e.status, e.message, e.code)
    }
    return errorResponse(500, e.message ?? "Undo failed", "SERVER_ERROR")
  }
}
