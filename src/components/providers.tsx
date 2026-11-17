"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import { useEffect } from "react"

export function Providers({ children }: { children: React.ReactNode }) {
  // Register the production service worker (disabled in dev so it never serves stale code).
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" })
    }
  }, [])

  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem>
      {children}
    </NextThemesProvider>
  )
}
