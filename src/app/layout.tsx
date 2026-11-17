import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"
import { AppShell } from "@/components/app-shell"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" })

export const metadata: Metadata = {
  applicationName: "Bailsync",
  title: "Bailsync — Cricket Scoring & Tournament Management",
  description: "Offline-resilient club cricket scoring and tournament management.",
  authors: [{ name: "Bailsync" }],
  formatDetection: { telephone: false },
  icons: [
    { rel: "icon", sizes: "192x192", type: "image/png", url: "/icons/icon-192x192.png" },
    { rel: "icon", sizes: "512x512", type: "image/png", url: "/icons/icon-512x512.png" },
    { rel: "apple-touch-icon", sizes: "180x180", type: "image/png", url: "/icons/apple-touch-icon.png" },
    { rel: "mask-icon", color: "#0f172a", url: "/icons/icon-maskable-512x512.png" },
  ],
  openGraph: {
    siteName: "Bailsync",
    title: "Bailsync — Cricket Scoring",
    description: "Club cricket scoring and tournament management.",
  },
  appleWebApp: {
    capable: true,
    title: "Bailsync",
    statusBarStyle: "default",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.variable}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
