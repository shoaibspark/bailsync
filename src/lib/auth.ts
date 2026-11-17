// lib/auth.ts
// Session-based auth using JWT in an httpOnly cookie (jose).
// Roles: ADMIN, SCORER, VIEWER. Public spectator pages need no login.

import { SignJWT, jwtVerify } from "jose"
import { db } from "./db"
import { AppRole } from "./roles"

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.AUTH_SECRET || "dev-secret",
)

const COOKIE_NAME = "bailsync_session"
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export type Session = {
  userId: string
  email: string
  role: AppRole
  clubId: string | null
}

export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import("bcryptjs")
  return bcrypt.hash(password, 10)
}

export async function comparePassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  const bcrypt = await import("bcryptjs")
  return bcrypt.compare(plain, hash)
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
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
}

export function extractToken(cookie: string | undefined): string | null {
  if (!cookie) return null
  const value = cookie.trim()
  if (!value) return null
  if (!value.includes("=")) return value
  const match = value.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`),
  )
  return match ? decodeURIComponent(match[1]) : null
}

export { COOKIE_NAME }

export async function getUserByEmail(email: string) {
  return db.user.findUnique({ where: { email } })
}

export async function getUserById(userId: string) {
  return db.user.findUnique({ where: { id: userId } })
}

export async function isFirstUser(): Promise<boolean> {
  const count = await db.user.count()
  return count === 0
}

export const SCORER_ROLES: Session["role"][] = ["SUPERADMIN", "ADMIN", "SCORER"]

export function canScore(role: Session["role"]): boolean {
  return SCORER_ROLES.includes(role)
}
