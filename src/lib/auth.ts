// lib/auth.ts
// Session-based auth using JWT in an httpOnly cookie (jose).
// Roles: ADMIN, SCORER, VIEWER. Public spectator pages need no login.

import { db } from "./db"
import { AppRole } from "./roles"
import { Session } from "./session-token"

export {
  COOKIE_NAME,
  SESSION_TTL_MS,
  clearSessionCookieHeader,
  extractToken,
  setSessionCookieHeader,
  signSession,
  verifySession,
} from "./session-token"
export type { Session } from "./session-token"

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

export async function getUserByEmail(email: string) {
  return db.user.findUnique({
    where: { email },
    include: { clubs: { select: { clubId: true } } },
  })
}

export async function getUserById(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    include: { clubs: { select: { clubId: true } } },
  })
}

export async function isFirstUser(): Promise<boolean> {
  const count = await db.user.count()
  return count === 0
}

export const SCORER_ROLES: Session["role"][] = ["SUPERADMIN", "ADMIN", "SCORER"]

export function canScore(role: Session["role"]): boolean {
  return SCORER_ROLES.includes(role)
}
