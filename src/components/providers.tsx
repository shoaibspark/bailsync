"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import { useEffect, useLayoutEffect, useState } from "react"
import { Provider as ReduxProvider } from "react-redux"
import { Toaster } from "react-hot-toast"
import { makeStore, type AppStore } from "@/lib/store"
import {
  readStoredSession,
  sessionReceived,
  sessionRestored,
  writeStoredSession,
  type SessionUser,
} from "@/lib/session-slice"

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect

function AppToaster() {
  return (
    <Toaster
      position="top-center"
      gutter={8}
      containerClassName="pointer-events-none"
      containerStyle={{ top: "4.5rem" }}
      toastOptions={{
        duration: 3500,
        className:
          "!pointer-events-auto !rounded-xl !border !border-border !bg-background !text-foreground !text-sm !shadow-lg",
        success: { iconTheme: { primary: "#16a34a", secondary: "#ffffff" } },
        error: { iconTheme: { primary: "#dc2626", secondary: "#ffffff" } },
      }}
    />
  )
}

function SessionBootstrap({ store }: { store: AppStore }) {
  useIsomorphicLayoutEffect(() => {
    const stored = readStoredSession()
    if (stored) store.dispatch(sessionRestored(stored))

    let active = true
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => (response.ok ? await response.json() : null))
      .then((payload: { user?: SessionUser | null } | null) => {
        if (!active) return
        const user = payload?.user ?? null
        store.dispatch(sessionReceived(user))
        writeStoredSession(user)
      })
      .catch(() => {
        if (!active) return
        store.dispatch(sessionRestored(stored))
        writeStoredSession(stored)
      })

    return () => {
      active = false
    }
  }, [store])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [store] = useState(() => makeStore())

  // Register the production service worker (disabled in dev so it never serves stale code).
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" })
    }
  }, [])

  return (
    <ReduxProvider store={store}>
      <NextThemesProvider attribute="class" defaultTheme="light" enableSystem>
        <SessionBootstrap store={store} />
        {children}
        <AppToaster />
      </NextThemesProvider>
    </ReduxProvider>
  )
}
