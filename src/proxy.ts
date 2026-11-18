import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { extractToken, verifySession } from "@/lib/session-token"

const PROTECTED_PAGE_PATTERNS = [
  /^\/clubs\/?$/,
  /^\/tournaments\/?$/,
  /^\/players\/?$/,
  /^\/admin(?:\/.*)?$/,
  /^\/matches\/new\/?$/,
  /^\/matches\/[^/]+\/score\/?$/,
  /^\/matches\/[^/]+\/setup\/?$/,
]

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const protectedPage = PROTECTED_PAGE_PATTERNS.some((pattern) => pattern.test(pathname))

  if (protectedPage) {
    const token = extractToken(req.cookies.get("bailsync_session")?.value)
    const session = token ? await verifySession(token) : null
    if (!session) {
      const url = new URL("/login", req.url)
      url.searchParams.set("callbackUrl", `${pathname}${search}`)
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icons|sw.js|manifest.webmanifest).*)"],
}
