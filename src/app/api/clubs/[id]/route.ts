import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth, requireScorer, errorResponse, json } from "@/lib/api"
const clubSchema = z.object({
  name: z.string().min(1).optional(),
  shortName: z.string().optional(),
  city: z.string().optional(),
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
  const { id } = await params
  const session = await requireAuth(req)
  requireScorer(session)
  let body: any
  try {
    body = clubSchema.parse(await req.json())
  } catch {
    return errorResponse(400, "Validation error", "VALIDATION_ERROR")
  }
  const club = await db.club.update({ where: { id }, data: body })
  return json(club)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await requireAuth(_req as NextRequest)
  requireScorer(session)
  await db.club.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
