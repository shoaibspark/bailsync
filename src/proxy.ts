import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { extractToken } from "@/lib/auth"

const PROTECTED_PAGE_PATTERNS = [
  /^\/clubs\/?$/,
  /^\/tournaments\/?$/,
  /^\/players\/?$/,
  /^\/admin(?:\/.*)?$/,
  /^\/matches\/new\/?$/,
  /^\/matches\/[^/]+\/score\/?$/,
  /^\/matches\/[^/]+\/setup\/?$/,
]

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const protectedPage = PROTECTED_PAGE_PATTERNS.some((pattern) => pattern.test(pathname))

  if (protectedPage) {
    const token = extractToken(req.cookies.get("bailsync_session")?.value)
    if (!token) {
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
