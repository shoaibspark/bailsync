import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import {
  requireAuth,
  requireSuperadmin,
  requireClubManager,
  errorResponse,
  json,
  parseBody,
} from "@/lib/api"

const clubSchema = z.object({
  name: z.string().min(1).optional(),
  shortName: z.string().max(6).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
})

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const club = await db.club.findUnique({ where: { id } })
  if (!club) return errorResponse(404, "Club not found", "NOT_FOUND")
  return json(club)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const session = await requireAuth(req)
    requireClubManager(session, id)
    const body = clubSchema.parse(await parseBody(req))
    const club = await db.club.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.shortName !== undefined ? { shortName: body.shortName || null } : {}),
        ...(body.city !== undefined ? { city: body.city || null } : {}),
      },
    })
    return json(club)
  } catch (e: any) {
    if (e instanceof z.ZodError) return errorResponse(400, "Check the club details and try again", "VALIDATION_ERROR")
    if (e?.status === 401 || e?.status === 403) return errorResponse(e.status, e.message, e.code)
    if (e?.code === "P2002") return errorResponse(409, "A club with this name already exists", "CLUB_EXISTS")
    if (e?.code === "P2025") return errorResponse(404, "Club not found", "NOT_FOUND")
    return errorResponse(500, e.message ?? "Unable to update the club", "SERVER_ERROR")
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const session = await requireAuth(req)
    requireSuperadmin(session)
    await db.club.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e?.status === 401 || e?.status === 403) return errorResponse(e.status, e.message, e.code)
    if (e?.code === "P2025") return errorResponse(404, "Club not found", "NOT_FOUND")
    return errorResponse(500, e.message ?? "Unable to delete the club", "SERVER_ERROR")
  }
}
