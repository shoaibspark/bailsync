# Bailsync — TODO

## Phase 1: Scaffold and infra
- [ ] 1.1 Initialize Next.js App Router (TS, Tailwind) + `package.json` deps
- [ ] 1.2 Add `docker-compose.yml` (Postgres 16, named volume, healthcheck)
- [ ] 1.3 Add `.env.example` and `.env` (DATABASE_URL, AUTH_SECRET, JWT_SECRET, etc.)
- [ ] 1.4 Configure tsconfig, eslint, vitest, scripts (dev/build/test/db:migrate/db:seed/db:studio)

## Phase 2: Schema and seed
- [ ] 2.1 Write `prisma/schema.prisma` (enums, relations, indexes, additive fields)
- [ ] 2.2 Create migration + `prisma migrate dev`
- [ ] 2.3 Write idempotent `prisma/seed.ts` (users, clubs, players, tournament, matches, ball events)
- [ ] 2.4 Wire `prisma db seed` into package.json scripts

## Phase 3: Core engine + wire codec + tests
- [ ] 3.1 Write `lib/wire-codec.ts` (encodeSseFrame/decodeSseFrame/encodeBody/decodeBody/contentType, dev JSON vs prod MessagePack)
- [ ] 3.2 Write `lib/cricket-engine/types.ts` + `reducer.ts` (pure computeInningsState/computeMatchState)
- [ ] 3.3 Write `lib/cricket-engine/selectors.ts` + `formatters.ts`
- [ ] 3.4 Write `lib/cricket-engine/validateEventStream.ts`
- [ ] 3.5 Write `lib/tournament/standings.ts` (points table + NRR, all-out rule)
- [ ] 3.6 Write `lib/stats/player.ts` (career aggregation)
- [ ] 3.7 Vitest suite: reducer, NRR, wire codec, stats aggregation — green

## Phase 4: Auth, SSE hub, API routes
- [ ] 4.1 Auth (bcrypt, jose httpOnly session cookie), middleware + per-route checks
- [ ] 4.2 `lib/realtime/sse-hub.ts` (globalThis singleton, EventEmitter, last-state cache)
- [ ] 4.3 API: GET stream (SSE), GET state, POST balls, PATCH ball, DELETE last, undo
- [ ] 4.4 API: handoff generate/claim
- [ ] 4.5 API: CRUD clubs, players, tournaments, matches, squads, toss, setup/start, innings transitions
- [ ] 4.6 API: tournament standings, player stats, auth routes (login/logout/register)
- [ ] 4.7 zod validation, consistent error shapes, Prisma transactions + sequence safety

## Phase 5: Frontend (shadcn/ui)
- [ ] 5.1 shadcn init + required components + high-contrast theme tokens in globals.css
- [ ] 5.2 Shared layout + auth pages (login/logout/register)
- [ ] 5.3 Clubs + rosters pages (`/clubs`, `/clubs/[clubId]`)
- [ ] 5.4 Tournaments + points table (`/tournaments`, `/tournaments/[id]`)
- [x] 5.5 Match creation/setup/toss flow (`/matches/new`, `/matches/[matchId]/setup`)
- [x] 5.6 Scoring console (`/matches/[matchId]/score`): big buttons, prompts, offline queue (IndexedDB + localStorage fallback), sync indicator, undo, ball editor, handoff
- [x] 5.7 Public match center (`/matches/[matchId]`) + SSE hook (`useMatchStream`)
- [x] 5.8 OBS overlay (`/matches/[matchId]/overlay`): transparent lower-third ticker + banners
- [x] 5.9 Player career stats (`/players/[playerId]`)

## Phase 6: Hardening (incl PWA/responsive)
- [x] 6.1 Error boundaries + loading/empty states
- [x] 6.2 Accessibility pass + responsive pass (320px to 1920x1080)
- [x] 6.3 PWA and responsive hardening (manifest, service worker, install prompt, touch ergonomics, performance)
- [x] 6.4 `tsc --noEmit`, lint, vitest, next build all clean
- [x] 6.5 End-to-end manual verification
- [x] 6.6 Playwright mobile projects + smoke tests
- [x] 6.7 Lighthouse targets verification

## Phase 7: Docs
- [x] 7.1 README.md (architecture, event sourcing, wire codec, offline queue, SSE caveat, demo creds)
- [x] 7.2 DECISIONS.md (theme tokens, no-ball ball-faced choice, single-instance limitation, etc.)
