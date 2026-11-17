import type { NextRequest } from "next/server"
import { errorResponse, json } from "@/lib/api"
import { getMatchStateSnapshot } from "@/lib/cricket-engine/match-state"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { matchId } = await params
  const state = await getMatchStateSnapshot(matchId)
  if (!state) return errorResponse(404, "Match not found", "NOT_FOUND")
  return json(state)
}
