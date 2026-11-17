"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarDays,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Trophy,
  UserRound,
  UsersRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"
import { AppRole, isManager } from "@/lib/roles"

type SessionUser = {
  id: string
  name: string | null
  email: string
  role: AppRole
  clubIds: string[]
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

const bottomNavigation = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/matches", label: "Matches", icon: Trophy },
  { href: "/tournaments", label: "Series", icon: CalendarDays },
  { href: "/clubs", label: "Clubs", icon: UsersRound },
  { href: "/players", label: "Players", icon: UserRound },
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
  const [drawerOpen, setDrawerOpen] = useState(false)
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

  useEffect(() => {
    setDrawerOpen(false)
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
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6 lg:px-8">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-10 shrink-0 lg:hidden"
                aria-label="Open navigation menu"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] max-w-sm p-0">
              <SheetHeader className="border-b p-5 text-left">
                <SheetTitle className="flex items-center gap-2.5">
                  <BrandMark className="size-9 rounded-xl" />
                  Bailsync
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {user ? `Signed in as ${user.name || user.email}` : "Browse the workspace"}
                </SheetDescription>
              </SheetHeader>
              <nav className="flex flex-col gap-1 overflow-y-auto p-3" aria-label="All sections">
                {visibleNavigation.map((item) => {
                  const active = isActive(pathname, item.href)
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="size-5 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      <ChevronRight className="size-4 opacity-50" />
                    </Link>
                  )
                })}
                {user ? (
                  <>
                    <Separator className="my-2" />
                    <div className="rounded-lg border bg-muted/40 p-3">
                      <p className="truncate text-sm font-semibold">{user.name || user.email}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10px]">{user.role}</Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {user.clubIds.length} club{user.clubIds.length === 1 ? "" : "s"}
                        </Badge>
                      </div>
                    </div>
                    <Button variant="outline" className="mt-2 justify-start" onClick={signOut}>
                      <LogOut data-icon="inline-start" />
                      Sign out
                    </Button>
                  </>
                ) : (
                  <Button asChild className="mt-2">
                    <Link href="/login">Sign in</Link>
                  </Button>
                )}
              </nav>
            </SheetContent>
          </Sheet>

          <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="Bailsync home">
            <BrandMark className="size-8 rounded-lg shadow-sm transition-transform group-hover:-rotate-6 sm:size-9 sm:rounded-xl" />
            <span className="hidden text-base font-black tracking-tight sm:inline sm:text-lg">Bailsync</span>
          </Link>

          <nav className="ml-2 hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden size-9 sm:inline-flex"
                  onClick={signOut}
                  aria-label="Sign out"
                >
                  <LogOut />
                </Button>
              </>
            ) : (
              <Button asChild size="sm" className="h-9 sm:h-8">
                <Link href="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="min-h-[calc(100vh-4rem)] pb-[calc(5rem+env(safe-area-inset-bottom))] outline-none lg:pb-0">
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl lg:hidden"
        aria-label="Primary sections"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {bottomNavigation.map((item) => {
            const active = isActive(pathname, item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[10px] font-medium transition-colors sm:min-h-12 sm:gap-1 sm:text-[11px]",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4 sm:size-5", active && "stroke-[2.5]")} />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
