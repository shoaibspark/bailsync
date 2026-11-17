import type { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth, requireRole, errorResponse, json, parseBody } from "@/lib/api"
import { isSuperadmin } from "@/lib/roles"

const updateSchema = z
  .object({
    userId: z.string().uuid(),
    role: z.enum(["SUPERADMIN", "ADMIN", "SCORER", "VIEWER"]).optional(),
    clubIds: z.array(z.string().uuid()).optional(),
  })
  .refine((value) => value.role !== undefined || value.clubIds !== undefined, {
    message: "Choose a role or club to update",
  })

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req)
    requireRole(session, ["SUPERADMIN", "ADMIN"])
    const users = await db.user.findMany({
      where: isSuperadmin(session.role)
        ? {}
        : session.clubIds.length
          ? { clubs: { some: { clubId: { in: session.clubIds } } } }
          : { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        clubs: { select: { clubId: true, club: { select: { id: true, name: true } } } },
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    })
    return json(
      users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        clubIds: user.clubs.map((membership) => membership.clubId),
        clubs: user.clubs.map((membership) => membership.club),
        createdAt: user.createdAt,
      })),
    )
  } catch (e: any) {
    if (e?.status === 401 || e?.status === 403) return errorResponse(e.status, e.message, e.code)
    return errorResponse(500, e.message ?? "Unable to load users", "SERVER_ERROR")
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth(req)
    requireRole(session, ["SUPERADMIN", "ADMIN"])
    const body = updateSchema.parse(await parseBody(req))

    const target = await db.user.findUnique({
      where: { id: body.userId },
      include: { clubs: { select: { clubId: true } } },
    })
    if (!target) return errorResponse(404, "User not found", "NOT_FOUND")

    const targetClubIds = target.clubs.map((membership) => membership.clubId)

    if (!isSuperadmin(session.role)) {
      const sharesClub = targetClubIds.some((clubId) => session.clubIds.includes(clubId))
      if (!sharesClub) {
        return errorResponse(403, "You can only manage users in your own clubs", "FORBIDDEN")
      }
      if (body.clubIds !== undefined) {
        const outsideScope = body.clubIds.some((clubId) => !session.clubIds.includes(clubId))
        if (outsideScope) {
          return errorResponse(403, "You can only assign your own clubs", "FORBIDDEN")
        }
      }
      if (body.role !== undefined && body.role !== "SCORER" && body.role !== "VIEWER") {
        return errorResponse(403, "Club admins can only assign scorer or viewer access", "FORBIDDEN")
      }
      if (target.id === session.userId) {
        return errorResponse(409, "You cannot change your own access", "SELF_CHANGE")
      }
    }

    if (body.role && body.role !== "SUPERADMIN" && target.role === "SUPERADMIN") {
      const superadminCount = await db.user.count({ where: { role: "SUPERADMIN" } })
      if (superadminCount <= 1) {
        return errorResponse(409, "The workspace must keep at least one super admin", "LAST_SUPERADMIN")
      }
    }

    const user = await db.user.update({
      where: { id: body.userId },
      data: {
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.clubIds !== undefined
          ? {
              clubs: {
                deleteMany: {},
                create: body.clubIds.map((clubId) => ({ clubId })),
              },
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        clubs: { select: { clubId: true } },
      },
    })

    return json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      clubIds: user.clubs.map((membership) => membership.clubId),
    })
  } catch (e: any) {
    if (e instanceof z.ZodError) return errorResponse(400, "Choose a valid role", "VALIDATION_ERROR")
    if (e?.status === 401 || e?.status === 403) return errorResponse(e.status, e.message, e.code)
    return errorResponse(500, e.message ?? "Unable to update the user", "SERVER_ERROR")
  }
}
