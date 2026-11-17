"use client"

import { useEffect, useState } from "react"
import { AppRole } from "@/lib/roles"

export type Session = {
  userId: string
  email: string
  role: AppRole
  clubId: string | null
}

type SessionResponse = {
  user: {
    id: string
    name: string | null
    email: string
    role: AppRole
    clubId: string | null
  } | null
}

export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null
        return response.json() as Promise<SessionResponse>
      })
      .then((payload) => {
        if (cancelled || !payload?.user) return
        setSession({
          userId: payload.user.id,
          email: payload.user.email,
          role: payload.user.role,
          clubId: payload.user.clubId,
        })
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { session, loading }
}
