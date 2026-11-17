import type { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth, requireScorer, errorResponse, json, parseBody } from "@/lib/api"

const clubSchema = z.object({
  name: z.string().min(2).max(100),
  shortName: z.string().max(6).optional(),
  city: z.string().max(100).optional(),
})

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const clubs = await db.club.findMany({ orderBy: { name: "asc" } })
  return json(clubs)
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req)
    requireScorer(session)
    const body = clubSchema.parse(await parseBody(req))
    const club = await db.club.create({
      data: {
        name: body.name,
        shortName: body.shortName || null,
        city: body.city || null,
      },
    })
    return json(club, 201)
  } catch (e: any) {
    if (e instanceof z.ZodError) return errorResponse(400, "Check the club details and try again", "VALIDATION_ERROR")
    if (e?.status === 401 || e?.status === 403) return errorResponse(e.status, e.message, e.code)
    if (e?.code === "P2002") return errorResponse(409, "A club with this name already exists", "CLUB_EXISTS")
    return errorResponse(500, e.message ?? "Unable to create the club", "SERVER_ERROR")
  }
}
