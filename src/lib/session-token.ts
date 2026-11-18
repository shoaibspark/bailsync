import { SignJWT, jwtVerify } from "jose"
import { AppRole } from "./roles"

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.AUTH_SECRET || "dev-secret",
)

export const COOKIE_NAME = "bailsync_session"
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type Session = {
  userId: string
  email: string
  role: AppRole
  clubIds: string[]
}

export async function signSession(session: Session): Promise<string> {
  return new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET)
}

export async function verifySession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as Session
  } catch {
    return null
  }
}

export function setSessionCookieHeader(token: string): string {
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${Math.floor(
    SESSION_TTL_MS / 1000,
  )}; SameSite=Lax${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`
}

export function clearSessionCookieHeader(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`
}

export function extractToken(cookie: string | undefined): string | null {
  if (!cookie) return null
  const value = cookie.trim()
  if (!value) return null
  if (!value.includes("=")) return value
  const match = value.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`),
  )
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}
