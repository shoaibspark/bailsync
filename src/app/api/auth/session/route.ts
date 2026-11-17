import type { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { extractToken, verifySession } from "@/lib/auth"
import { json } from "@/lib/api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const token = extractToken(req.cookies.get("bailsync_session")?.value)
  if (!token) return json({ user: null })

  const session = await verifySession(token)
  if (!session) return json({ user: null })

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      clubs: { select: { clubId: true } },
    },
  })

  if (!user) return json({ user: null })

  return json({ user: { ...user, clubIds: user.clubs.map((club) => club.clubId) } })
}
