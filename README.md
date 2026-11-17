# Bailsync

Club cricket scoring and tournament management web application — **offline-resilient, event-sourced, real-time**.

Built with Next.js 16 (App Router), TypeScript, React 19, PostgreSQL 16 + Prisma, Tailwind CSS + shadcn/ui.

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, TypeScript, React 19) |
| Database / ORM | PostgreSQL 16 + Prisma |
| Real-time | Server-Sent Events (`/api/matches/[id]/stream`) + in-memory `EventEmitter` hub (`globalThis`-cached singleton) |
| Serialization | `@msgpack/msgpack` in production; plain JSON in development (`lib/wire-codec.ts`) |
| Auth | JWT session in httpOnly cookie (`jose`), bcrypt hashing; roles ADMIN / SCORER / VIEWER |
| UI | Tailwind CSS + shadcn/ui (Radix), lucide-react |
| Styling | High-contrast light-mode default (outdoor readable), dark mode via next-themes |
| Offline | IndexedDB (`idb`) queue with localStorage fallback; client UUIDs (`clientEventId`) for idempotency |
| PWA | Web App Manifest, service worker (`public/sw.js`), install prompt, offline fallback page |
| Testing | Vitest |
| Lint / Type | ESLint (eslint-config-next), `tsc --noEmit` |

## Hard constraints honoured

- **No Redis / RabbitMQ / message broker.** Real-time broadcasting is an in-memory `EventEmitter` pub/sub hub cached on `globalThis`. Documented single-instance limitation below.
- **SSE route runs on Node runtime** (`export const runtime = 'nodejs'`, `dynamic = 'force-dynamic'`).
- **Wire codec dev/prod:** `NODE_ENV === 'development'` → plain JSON SSE frames readable in DevTools. `NODE_ENV === 'production'` → MessagePack, Base64-encoded in SSE `data:` frames, raw binary `application/x-msgpack` on sync POST/GET routes. One shared isomorphic `lib/wire-codec.ts` used by server routes and client hooks.
- **Event-sourced pure reducer** in `lib/cricket-engine/reducer.ts` (no I/O, no `Date.now()`, no randomness). `BallEvent` rows are immutable; totals are recomputed from the stream.
- **Auth:** credentials email+password, httpOnly session cookie. Public spectator pages need no login. Scoring/management routes require SCORER/ADMIN, enforced via middleware + per-route checks.

## Project structure

```
prisma/
  schema.prisma      # Prisma data model (enums, relations, indexes, additive fields)
  seed.ts            # Idempotent seed (users, clubs, players, tournament, matches, ball events)
  migrations/        # SQL migrations
src/
  app/               # Next.js App Router pages + route handlers
  components/        # shadcn/ui primitives + cricket-specific components
  lib/
    db.ts            # Prisma client singleton
    auth.ts          # JWT session (jose), password hashing
    api.ts           # Route-handler helpers (auth, json/msgpack body, errors)
    api-client.ts    # Client fetch helper (same wire protocol)
    wire-codec.ts    # Isomorphic JSON/MessagePack serializer
    cricket-engine/  # Pure reducer, selectors, formatters, validateEventStream
    tournament/      # Standings + NRR engine (all-out rule)
    stats/           # Player career aggregation
    realtime/        # SSE hub (EventEmitter singleton)
    offline-queue.ts # IndexedDB pending-ball queue
  hooks/             # useMatchStream (SSE client hook)
  middleware.ts      # Auth middleware
```

## Getting started

### Prerequisites
- Docker & Docker Compose
- Node 20+

### 1. Install dependencies

```bash
npm install
```

### 2. Start PostgreSQL

```bash
cp .env.example .env
docker compose up -d
```

Wait for the `pg_isready` healthcheck to pass.

### 3. Set up the database

```bash
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
```

### 4. Run the dev server

```bash
npm run dev
```

Visit `http://localhost:3000`.

### Production build (MessagePack mode)

```bash
npm run build
npm start
```

## Useful scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm test` | Vitest test suite |
| `npx tsc --noEmit` | Type-check |
| `npm run db:migrate` | Create/apply a Prisma migration |
| `npm run db:migrate:deploy` | Apply migrations non-interactively |
| `npm run db:seed` | Seed the database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run pwa:icons` | Regenerate PWA icons from `scripts/icon-source.svg` |

## Demo credentials

| Role | Email | Password |
|------|-------|----------|
| ADMIN | admin@bailsync.local | bailsync123 |
| SCORER | scorer1@bailsync.local | bailsync123 |
| SCORER | scorer2@bailsync.local | bailsync123 |

First registered user becomes ADMIN.

## Seeded data

- **2 clubs:** Eagles CC, Hawks CC (11 players each)
- **1 tournament:** City T20 League (20 overs, 4 max overs/bowler)
- **1 live match:** Eagles vs Hawks, innings 1 in progress (includes wide, no-ball, boundary, six, wicket, byes)
- **2 completed matches:** one all-out innings (demonstrates the all-out NRR rule) and one tie

## Key pages

| Path | Description | Auth |
|------|-------------|------|
| `/` | Home — recent matches | Public |
| `/matches/[id]` | Public live scorecard (SSE) | Public |
| `/matches/[id]/score` | Scoring console (big tap buttons, offline queue, undo) | SCORER/ADMIN |
| `/matches/[id]/overlay` | Transparent OBS lower-third TV overlay (SSE) | Public |
| `/matches/new` | Create a match | SCORER/ADMIN |
| `/matches/[id]/setup` | Toss, Playing XI, start innings | SCORER/ADMIN |
| `/clubs` | Clubs & rosters | SCORER/ADMIN |
| `/tournaments` | Tournaments & create | SCORER/ADMIN |
| `/tournaments/[id]/standings` | Points table + NRR | Public |
| `/players/[id]` | Career batting/bowling/fielding stats | Public |
| `/login`, `/register` | Auth | Public |

## Architecture notes

### Event-sourced cricket engine
Every delivery is an immutable `BallEvent` row ordered by `sequenceNumber`. The pure reducer `computeInningsState(matchConfig, inningsSetup, ballEvents[])` recomputes totals, batter/bowler scorecards, FoW, partnerships, over timeline, and result from the stream. Undo soft-deletes (`deletedAt`) the last event and recomputes. Mid-innings edits update a historical `BallEvent` and the reducer re-runs over the whole stream with `validateEventStream()` catching inconsistencies.

### Wire codec
`lib/wire-codec.ts` exposes `encodeSseFrame`, `decodeSseFrame`, `encodeBody`, `decodeBody`, `contentType`. Dev sends JSON; production sends MessagePack (Base64 in SSE frames, raw binary on sync routes). The server decodes by incoming `Content-Type`, accepting either format.

### Real-time hub
`lib/realtime/sse-hub.ts` is a `globalThis`-cached singleton wrapping `EventEmitter` with `subscribe`/`publish`, per-match last-state caching, and listener tracking. Every state-changing route publishes after the DB commit; the SSE route reconnects with a heartbeat every ~15s.

### Offline queue
Pending balls are persisted in IndexedDB (`idb`) with `localStorage` fallback, tagged with `clientEventId` for idempotent server handling. On `navigator.onLine` the queue flushes in order with retry/backoff. A sync indicator shows Online / Offline / pending N / Synced.

### NRR engine (all-out rule)
NRR = (runs scored ÷ overs faced) − (runs conceded ÷ overs bowled), overs converted from balls. If a team is bowled out before its quota, overs faced count as the **full `oversPerInnings`** (not actual overs bowled), and the same applies to the opposition's overs bowled for that innings.

## PWA & mobile

- Installable PWA (manifest at `/manifest.json` via `app/manifest.ts`), maskable icon, shortcuts.
- Service worker caches app shell + read APIs; **never** caches the SSE stream or mutating/write/auth requests.
- Offline fallback page at `/offline`.
- Mobile-first: bottom tab navigation, thumb-zone scoring buttons (>= 64px), dynamic viewport units, safe-area insets, `clamp()` typography, no horizontal scroll at 320px–1920px.
- Service worker disabled in `next dev`.

### Known iOS limitation
iOS Safari does not support Background Sync or `beforeinstallprompt`; users must use "Share → Add to Home Screen". The foreground flush remains the guaranteed offline path.

## Single-instance SSE caveat

The real-time hub is an **in-memory `EventEmitter`** cached on `globalThis`. It works for a single Node process. If you run multiple server instances (e.g. multiple `next start` containers without sticky sessions), SSE subscribers on instance A won't receive publishes from instance B. For multi-instance deployments, replace the hub with a shared pub/sub (Redis, PostgreSQL LISTEN/NOTIFY, etc.).

## Testing

```bash
npm test
```

Covers the reducer (wides, no-balls incl. run-out, strike rotation, byes/leg-byes, penalty, maidens, CRR/RRR, wickets/FoW/partnerships, target chase, all-out, tie, Super Over, undo, mid-over edits, determinism, validation), NRR (all-out rule), wire codec round-trips, player stats aggregation, and SSE hub subscribe/publish/unsubscribe.

## License

MIT
