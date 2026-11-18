"use client"

import { useMemo } from "react"
import { useAppSelector } from "@/lib/store"
import type { SessionStatus, SessionUser } from "@/lib/session-slice"
import { AppRole } from "@/lib/roles"

export type Session = {
  userId: string
  email: string
  role: AppRole
  clubIds: string[]
}

export function useSession(): {
  session: Session | null
  user: SessionUser | null
  status: SessionStatus
  loading: boolean
  authenticated: boolean
} {
  const user = useAppSelector((state) => state.session.user)
  const status = useAppSelector((state) => state.session.status)

  const session = useMemo<Session | null>(
    () =>
      user
        ? {
            userId: user.id,
            email: user.email,
            role: user.role,
            clubIds: user.clubIds,
          }
        : null,
    [user],
  )

  return {
    session,
    user,
    status,
    loading: status === "loading",
    authenticated: status === "authenticated",
  }
}
