import type { NextRequest } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { requireAuth, requireRole, errorResponse, json, parseBody } from "@/lib/api"
import { isSuperadmin } from "@/lib/roles"

const updateSchema = z
  .object({
    userId: z.string().uuid(),
    role: z.enum(["SUPERADMIN", "ADMIN", "SCORER", "VIEWER"]).optional(),
    clubId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => value.role !== undefined || value.clubId !== undefined, {
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
        : session.clubId
          ? { clubId: session.clubId }
          : { id: session.userId },
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
    requireRole(session, ["SUPERADMIN", "ADMIN"])
    const body = updateSchema.parse(await parseBody(req))

    const target = await db.user.findUnique({ where: { id: body.userId } })
    if (!target) return errorResponse(404, "User not found", "NOT_FOUND")

    if (!isSuperadmin(session.role)) {
      if (!session.clubId || target.clubId !== session.clubId) {
        return errorResponse(403, "You can only manage users in your own club", "FORBIDDEN")
      }
      if (body.clubId !== undefined) {
        return errorResponse(403, "Only a super admin can move users between clubs", "FORBIDDEN")
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

    const data: Prisma.UserUpdateInput = {}
    if (body.role !== undefined) data.role = body.role
    if (body.clubId !== undefined) {
      data.club = body.clubId === null ? { disconnect: true } : { connect: { id: body.clubId } }
    }

    const user = await db.user.update({
      where: { id: body.userId },
      data,
      select: { id: true, name: true, email: true, role: true, clubId: true },
    })
    return json(user)
  } catch (e: any) {
    if (e instanceof z.ZodError) return errorResponse(400, "Choose a valid role", "VALIDATION_ERROR")
    if (e?.status === 401 || e?.status === 403) return errorResponse(e.status, e.message, e.code)
    return errorResponse(500, e.message ?? "Unable to update the user", "SERVER_ERROR")
  }
}
