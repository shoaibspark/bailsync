import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { AppRole } from "./roles"

export type SessionUser = {
  id: string
  name: string | null
  email: string
  role: AppRole
  clubIds: string[]
}

export type SessionStatus = "loading" | "authenticated" | "unauthenticated"

export type SessionState = {
  user: SessionUser | null
  status: SessionStatus
}

export const SESSION_STORAGE_KEY = "bailsync:session"

const initialState: SessionState = {
  user: null,
  status: "loading",
}

const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    sessionRestored(state, action: PayloadAction<SessionUser | null>) {
      state.user = action.payload
      state.status = action.payload ? "authenticated" : "unauthenticated"
    },
    sessionReceived(state, action: PayloadAction<SessionUser | null>) {
      state.user = action.payload
      state.status = action.payload ? "authenticated" : "unauthenticated"
    },
    sessionCleared(state) {
      state.user = null
      state.status = "unauthenticated"
    },
  },
})

export const { sessionRestored, sessionReceived, sessionCleared } =
  sessionSlice.actions

export const sessionReducer = sessionSlice.reducer

export function readStoredSession(): SessionUser | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SessionUser
    if (!parsed?.id || !parsed?.role || !Array.isArray(parsed.clubIds)) return null
    return normalizeUser(parsed)
  } catch {
    return null
  }
}

export function writeStoredSession(user: SessionUser | null) {
  if (typeof window === "undefined") return
  try {
    if (user) {
      window.localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify(normalizeUser(user)),
      )
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY)
    }
  } catch {
    // Storage can be unavailable in private mode; the in-memory store still works.
  }
}

function normalizeUser(user: SessionUser): SessionUser {
  return {
    id: user.id,
    name: user.name ?? null,
    email: user.email,
    role: user.role,
    clubIds: Array.isArray(user.clubIds) ? user.clubIds : [],
  }
}
