import { NextRequest } from "next/server"
import { z } from "zod"
import { comparePassword, signSession, setSessionCookieHeader } from "@/lib/auth"
import { db } from "@/lib/db"
import { errorResponse } from "@/lib/api"
import { AppRole } from "@/lib/roles"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = loginSchema.parse(await req.json())
    const user = await db.user.findUnique({ where: { email: body.email } })
    if (!user) {
      return errorResponse(401, "Invalid credentials", "INVALID_CREDENTIALS")
    }
    const ok = await comparePassword(body.password, user.passwordHash)
    if (!ok) {
      return errorResponse(401, "Invalid credentials", "INVALID_CREDENTIALS")
    }

    const token = await signSession({
      userId: user.id,
      email: user.email,
      role: user.role as AppRole,
      clubId: user.clubId,
    })

    return new Response(
      JSON.stringify({ user: { id: user.id, email: user.email, role: user.role } }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": setSessionCookieHeader(token),
        },
      },
    )
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return errorResponse(400, "Validation error", "VALIDATION_ERROR")
    }
    return errorResponse(500, e.message ?? "Login failed", "SERVER_ERROR")
  }
}
