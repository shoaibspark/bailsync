# Bailsync — DECISIONS.md

## No-ball balls-faced convention
- A no-ball counts as faced by the batter for balls-faced purposes (per MCC convention). Runs off the bat are credited to the batter and the bowler; byes/leg-byes off a no-ball are extras not charged beyond the no-ball penalty. Documented in `lib/cricket-engine/reducer.ts`.

## Wire codec dev/prod behavior
- `NODE_ENV === 'development'`: plain JSON SSE frames (`data: {json}`), Content-Type `application/json`. Readable in DevTools.
- `NODE_ENV === 'production'`: MessagePack. SSE `data:` frames use Base64-encoded MessagePack. Sync POST/GET routes use raw binary `application/x-msgpack`.
- `lib/wire-codec.ts` is isomorphic; Base64 via `btoa`/`atob` in browser, `Buffer` fallback in Node.
- Decode on server by incoming `Content-Type` (accepts either format).

## Real-time hub
- `globalThis`-cached singleton wrapping `EventEmitter` (lib/realtime/sse-hub.ts).
- SSE route at `/api/matches/[matchId]/stream`, runtime `nodejs`, `dynamic: 'force-dynamic'`.
- Single-instance limitation documented in README (EventEmitter is in-memory; multiple server instances won't share state).

## Offline queue
- IndexedDB (via `idb`) with `localStorage` fallback. Client-generated UUIDs (`clientEventId`) for idempotency. Auto-flush on `navigator.onLine` with retry/backoff.

## PWA
- Service worker: hand-written `public/sw.js` chosen over Serwist because the caching rules are simple and precise (never intercept SSE/mutating/auth), avoiding a heavier dependency. Registered in production only via `src/components/providers.tsx`; disabled in `next dev`.
- Caching: app shell CacheFirst (precached, including manifest + app icons), pages NetworkFirst → offline fallback (`/offline`), read APIs StaleWhileRevalidate, images CacheFirst. SSE stream and all mutating/auth requests bypass the cache.
- Manifest: `src/app/manifest.ts` (MetadataRoute), icons generated from `scripts/icon-source.svg` via `scripts/generate-icons.ts` (sharp) — 72/96/128/144/152/192/384/512 `any`, 192/512 `maskable`, 180 apple-touch-icon, multi-size `src/app/favicon.ico` (16/32/48), SVG `src/app/icon.svg`, Safari pinned-tab `mask-icon`. Shortcuts: Live Matches, Score a Match, Tournaments.
- iOS limitation: no `beforeinstallprompt` / Background Sync; users use "Share → Add to Home Screen". Foreground IndexedDB flush is the guaranteed offline path.

## App iconography
- Brand mark: cricket ball with seam above a three-stump wicket, on a slate `#0f172a` rounded square (`scripts/icon-source.svg`). Chosen because the ball + wicket silhouette stays legible at 16px (favicon) and 72px (Android launcher) without losing meaning.
- `scripts/icon-maskable.svg` keeps the same mark at 74% scale on a full-bleed square so Android's adaptive-icon mask never clips it (80% safe zone).
- `scripts/icon-mask.svg` is a single-colour silhouette for Safari pinned tabs (`mask-icon`).
- `npm run pwa:icons` regenerates every icon variant plus `src/app/favicon.ico`; the in-app header logo reuses the same artwork inline (`BrandMark` in `src/components/app-shell.tsx`).

## Theme tokens (high-contrast, outdoor-readable)
- Base color: `zinc` (near-black foreground `#0f172a` on white background `#ffffff` in light mode).
- Primary: `#0f172a` (slate-900) with white foreground — maximum contrast for score numbers.
- Light mode is the default (outdoor visibility). Dark mode available via `next-themes`.
- Critical numbers (score, wickets, overs) use `text-foreground` (near-black), never muted greys.
- Focus rings: `--ring` = primary, visible on all interactive elements.
- Border: `222.2 47% 11%` (strong, visible in sunlight).
- Tailwind v3 (shadcn v4 registry is missing several components; v3 + Radix gives full coverage).

## Prisma version
- Prisma 6 used (Prisma 7 removed `url` from schema.prisma and requires `prisma.config.ts`, adding complexity not needed here).
