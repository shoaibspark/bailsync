// lib/api.ts
// Shared helpers for Next.js route handlers: auth, JSON/msgpack body parsing,
// consistent error responses, and required-role enforcement.

import { NextRequest, NextResponse } from "next/server"
import { verifySession, extractToken, Session } from "./auth"
import { decodeBody } from "./wire-codec"

export interface RouteContext {
  params: Promise<{ [key: string]: string }> | { [key: string]: string }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public code?: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status })
}

export function errorResponse(status: number, message: string, code?: string) {
  return NextResponse.json(
    { error: { message, code } },
    { status },
  )
}

// Authenticate the request from the session cookie. Returns the session or throws 401.
export async function requireAuth(
  req: NextRequest,
): Promise<Session> {
  const token = extractToken(req.cookies.get("bailsync_session")?.value)
  if (!token) throw new ApiError(401, "Not authenticated", "UNAUTHENTICATED")
  const session = await verifySession(token)
  if (!session) throw new ApiError(401, "Invalid or expired session", "INVALID_SESSION")
  return session
}

export function requireRole(session: Session, allowed: Session["role"][]) {
  if (!allowed.includes(session.role)) {
    throw new ApiError(
      403,
      "Insufficient role",
      "FORBIDDEN",
    )
  }
}

export function requireScorer(session: Session) {
  requireRole(session, ["ADMIN", "SCORER"])
}

// Parse request body: msgpack (prod) or JSON (dev). Accepts either content type.
// decodeBody decides the format based on content-type + NODE_ENV.
export async function parseBody(req: NextRequest): Promise<unknown> {
  const ct = req.headers.get("content-type") ?? ""
  const arrayBuffer = await req.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  return decodeBody(ct, bytes)
}

export function msgpackOrJsonBody(req: NextRequest) {
  return parseBody(req)
}

export const runtime = "nodejs"

export const dynamic = "force-dynamic"
