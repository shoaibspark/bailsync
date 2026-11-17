import type { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth, requireRole, errorResponse, json, parseBody } from "@/lib/api"

const updateSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["ADMIN", "SCORER", "VIEWER"]),
})

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req)
    requireRole(session, ["ADMIN"])
    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        clubId: true,
        club: { select: { id: true, name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    })
    return json(users)
  } catch (e: any) {
    if (e?.status === 401 || e?.status === 403) return errorResponse(e.status, e.message, e.code)
    return errorResponse(500, e.message ?? "Unable to load users", "SERVER_ERROR")
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth(req)
    requireRole(session, ["ADMIN"])
    const body = updateSchema.parse(await parseBody(req))

    if (body.userId === session.userId && body.role !== "ADMIN") {
      const adminCount = await db.user.count({ where: { role: "ADMIN" } })
      if (adminCount <= 1) return errorResponse(409, "The workspace must keep at least one administrator", "LAST_ADMIN")
    }

    const user = await db.user.update({
      where: { id: body.userId },
      data: { role: body.role },
      select: { id: true, name: true, email: true, role: true, clubId: true },
    })
    return json(user)
  } catch (e: any) {
    if (e instanceof z.ZodError) return errorResponse(400, "Choose a valid role", "VALIDATION_ERROR")
    if (e?.status === 401 || e?.status === 403) return errorResponse(e.status, e.message, e.code)
    return errorResponse(500, e.message ?? "Unable to update the user", "SERVER_ERROR")
  }
}
