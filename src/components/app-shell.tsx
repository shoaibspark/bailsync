"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarDays,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Trophy,
  UserRound,
  UsersRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"
import { AppRole, isManager } from "@/lib/roles"

type SessionUser = {
  id: string
  name: string | null
  email: string
  role: AppRole
  clubId: string | null
}

const navigation = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/matches", label: "Matches", icon: Trophy },
  { href: "/clubs", label: "Clubs", icon: UsersRound },
  { href: "/tournaments", label: "Tournaments", icon: CalendarDays },
  { href: "/players", label: "Players", icon: UserRound },
]

const adminNavigation = [
  { href: "/admin/users", label: "Access", icon: ShieldCheck },
]

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="#0f172a" />
      <circle cx="16" cy="13" r="7" fill="#fbbf24" />
      <path d="M13.6 6.8C11.6 9.6 11.6 16.4 13.6 19.2" fill="none" stroke="#0f172a" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M18.4 6.8C20.4 9.6 20.4 16.4 18.4 19.2" fill="none" stroke="#0f172a" strokeWidth="1.4" strokeLinecap="round" />
      <g fill="#f8fafc">
        <rect x="10.4" y="21" width="11.2" height="1.8" rx="0.9" />
        <rect x="10.4" y="22" width="1.8" height="7" rx="0.9" />
        <rect x="15.1" y="22" width="1.8" height="7" rx="0.9" />
        <rect x="19.8" y="22" width="1.8" height="7" rx="0.9" />
      </g>
    </svg>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [user, setUser] = useState<SessionUser | null>(null)
  const overlay = pathname.includes("/overlay")
  const visibleNavigation = isManager(user?.role) ? [...navigation, ...adminNavigation] : navigation

  useEffect(() => {
    document.documentElement.dataset.overlay = overlay ? "true" : "false"
    return () => {
      delete document.documentElement.dataset.overlay
    }
  }, [overlay])

  useEffect(() => {
    let active = true
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null
        return response.json()
      })
      .then((payload: { user?: SessionUser | null } | null) => {
        if (active) setUser(payload?.user ?? null)
      })
      .catch(() => {
        if (active) setUser(null)
      })
    return () => {
      active = false
    }
  }, [pathname])

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    setUser(null)
    window.location.href = "/"
  }

  if (overlay) return <>{children}</>

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="Bailsync home">
            <BrandMark className="size-9 rounded-xl shadow-sm transition-transform group-hover:-rotate-6" />
            <span className="text-lg font-black tracking-tight">Bailsync</span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
            {visibleNavigation.map((item) => {
              const active = isActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            {user ? (
              <>
                <div className="hidden items-center gap-2 rounded-lg border px-3 py-1.5 sm:flex">
                  <div className="text-right">
                    <p className="max-w-32 truncate text-xs font-semibold">{user.name || user.email}</p>
                    <p className="text-[11px] text-muted-foreground">{user.role}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{user.role}</Badge>
                </div>
                <Button variant="ghost" size="icon" className="size-11 sm:size-9" onClick={signOut} aria-label="Sign out">
                  <LogOut />
                </Button>
              </>
            ) : (
              <Button asChild size="sm" className="h-11 sm:h-8">
                <Link href="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="min-h-[calc(100vh-4rem)] pb-[calc(6rem+env(safe-area-inset-bottom))] outline-none lg:pb-0">
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl lg:hidden"
        aria-label="Mobile navigation"
      >
        <div className={cn("mx-auto grid max-w-lg", visibleNavigation.length > 5 ? "grid-cols-6" : "grid-cols-5")}>
          {visibleNavigation.map((item) => {
            const active = isActive(pathname, item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "stroke-[2.5]")} />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
