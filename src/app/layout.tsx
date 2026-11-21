import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import "./globals.css"
import { Providers } from "@/components/providers"
import { AppShell } from "@/components/app-shell"

const inter = localFont({
  src: [
    { path: "./fonts/inter/Inter-100.ttf", weight: "100", style: "normal" },
    { path: "./fonts/inter/Inter-200.ttf", weight: "200", style: "normal" },
    { path: "./fonts/inter/Inter-300.ttf", weight: "300", style: "normal" },
    { path: "./fonts/inter/Inter-400.ttf", weight: "400", style: "normal" },
    { path: "./fonts/inter/Inter-500.ttf", weight: "500", style: "normal" },
    { path: "./fonts/inter/Inter-600.ttf", weight: "600", style: "normal" },
    { path: "./fonts/inter/Inter-700.ttf", weight: "700", style: "normal" },
    { path: "./fonts/inter/Inter-800.ttf", weight: "800", style: "normal" },
    { path: "./fonts/inter/Inter-900.ttf", weight: "900", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
})

export const metadata: Metadata = {
  applicationName: "Bailsync",
  title: "Bailsync — Cricket Scoring & Tournament Management",
  description: "Offline-resilient club cricket scoring and tournament management.",
  authors: [{ name: "Bailsync" }],
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/icons/icon-192x192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512x512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    other: [{ rel: "mask-icon", url: "/icons/mask-icon.svg", color: "#0f172a" }],
  },
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
