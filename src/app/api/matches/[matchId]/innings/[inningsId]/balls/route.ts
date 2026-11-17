import type { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { sseHub } from "@/lib/realtime/sse-hub"
import { getMatchStateSnapshot } from "@/lib/cricket-engine/match-state"
import { requireAuth, requireScorer, json, errorResponse, parseBody } from "@/lib/api"
import { Prisma } from "@prisma/client"

const ballSchema = z.object({
  inningsId: z.string(),
  sequenceNumber: z.number().int().positive(),
  overNumber: z.number().int().optional(),
  ballInOver: z.number().int().optional(),
  strikerId: z.string(),
  nonStrikerId: z.string(),
  bowlerId: z.string(),
  runsScored: z.number().int().min(0),
  extraType: z.enum(["NONE", "WIDE", "NO_BALL", "BYE", "LEG_BYE", "PENALTY"]),
  extraRuns: z.number().int().min(0),
  isWicket: z.boolean(),
  wicketType: z.enum(["BOWLED", "CAUGHT", "LBW", "RUN_OUT", "STUMPED", "HIT_WICKET", "RETIRED_HURT", "RETIRED_OUT", "OBSTRUCTING_FIELD", "TIMED_OUT"]).optional(),
  dismissedPlayerId: z.string().nullable().optional(),
  fielderId: z.string().nullable().optional(),
  incomingBatterId: z.string().nullable().optional(),
  clientEventId: z.string().optional(),
  commentaryText: z.string().optional(),
})

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string; inningsId: string }> },
) {
  try {
    const { matchId, inningsId } = await params
    const session = await requireAuth(req)
    requireScorer(session)

    const body = await parseBody(req)
    const balls = Array.isArray(body) ? body : [body]

    const results = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const created: Array<{ id: string; inningsId: string }> = []
      const last = await tx.ballEvent.aggregate({
        _max: { sequenceNumber: true },
        where: { inningsId },
      })
      let nextSequence = (last._max.sequenceNumber ?? 0) + 1
      for (const raw of balls) {
        const parsed = ballSchema.parse(raw)
        if (parsed.inningsId !== inningsId) {
          throw new Error("The ball does not belong to this innings")
        }
        if (parsed.clientEventId) {
          const existing = await tx.ballEvent.findUnique({
            where: { clientEventId: parsed.clientEventId },
          })
          if (existing) {
            created.push({ id: existing.id, inningsId: existing.inningsId })
            continue
          }
        }
        const event = await tx.ballEvent.create({
          data: {
            inningsId: parsed.inningsId,
            sequenceNumber: nextSequence++,
            overNumber: parsed.overNumber ?? 0,
            ballInOver: parsed.ballInOver ?? 0,
            strikerId: parsed.strikerId,
            nonStrikerId: parsed.nonStrikerId,
            bowlerId: parsed.bowlerId,
            runsScored: parsed.runsScored,
            extraType: parsed.extraType,
            extraRuns: parsed.extraRuns,
            isWicket: parsed.isWicket,
            wicketType: parsed.wicketType,
            dismissedPlayerId: parsed.dismissedPlayerId,
            fielderId: parsed.fielderId,
            incomingBatterId: parsed.incomingBatterId,
            clientEventId: parsed.clientEventId,
            commentaryText: parsed.commentaryText,
          },
          select: { id: true, inningsId: true },
        })
        created.push(event)
      }
      return created
    })

    const state = await getMatchStateSnapshot(matchId)
    if (state) sseHub.publish(matchId, state)

    return json({ ok: true, count: results.length })
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return errorResponse(400, "Invalid ball details", "VALIDATION_ERROR")
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return errorResponse(409, "This delivery has already been recorded", "CONFLICT")
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2023") {
      return errorResponse(400, "This delivery could not be stored", "VALIDATION_ERROR")
    }
    if (e?.status === 401 || e?.status === 403) {
      return errorResponse(e.status, e.message, e.code)
    }
    return errorResponse(500, e.message ?? "Failed to append balls", "SERVER_ERROR")
  }
}
