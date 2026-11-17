import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { hashPassword, isFirstUser, signSession, setSessionCookieHeader } from "@/lib/auth"
import { db } from "@/lib/db"
import { errorResponse } from "@/lib/api"
import { AppRole } from "@/lib/roles"

const registerSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email(),
  password: z.string().min(6),
})

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = registerSchema.parse(await req.json())
    const existing = await db.user.findUnique({ where: { email: body.email } })
    if (existing) {
      return errorResponse(409, "Email already registered", "EMAIL_EXISTS")
    }

    const first = await isFirstUser()
    const role = first ? "ADMIN" : "VIEWER"

    const passwordHash = await hashPassword(body.password)
    const user = await db.user.create({
      data: {
        name: body.name ?? null,
        email: body.email,
        passwordHash,
        role,
      },
      select: { id: true, email: true, role: true, clubId: true },
    })

    const token = await signSession({
      userId: user.id,
      email: user.email,
      role: user.role as AppRole,
      clubId: user.clubId,
    })

    return NextResponse.json(
      { user: { id: user.id, email: user.email, role: user.role } },
      {
        status: 201,
        headers: { "Set-Cookie": setSessionCookieHeader(token) },
      },
    )
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return errorResponse(400, "Validation error", "VALIDATION_ERROR")
    }
    return errorResponse(500, e.message ?? "Register failed", "SERVER_ERROR")
  }
}
