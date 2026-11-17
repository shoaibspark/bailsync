// lib/cricket-engine/selectors.ts
// Derived UI-ready selectors over InningsState / MatchState.

import type {
  InningsState,
  MatchState,
  PlayerId,
} from "./types"

export interface PlayerNameResolver {
  (playerId: PlayerId): string
}

export function withPlayerNames<T extends { playerId: PlayerId }>(
  items: T[],
  resolveName: PlayerNameResolver,
): (T & { name: string })[] {
  return items.map((i) => ({ ...i, name: resolveName(i.playerId) }))
}

export function formatOvers(balls: number, ballsPerOver: number): string {
  const o = Math.floor(balls / ballsPerOver)
  const b = balls % ballsPerOver
  return `${o}.${b}`
}

export function strikeRate(runs: number, balls: number): number {
  return balls ? Math.round((runs / balls) * 100) : 0
}

export function economy(runs: number, balls: number): number {
  return balls ? Math.round((runs / (balls / 6)) * 100) / 100 : 0
}

export function average(
  runs: number,
  dismissals: number,
): number | null {
  return dismissals ? Math.round((runs / dismissals) * 100) / 100 : null
}

export function isBoundary(runs: number): boolean {
  return runs === 4 || runs === 6
}

export function battingSummary(
  innings: InningsState,
  resolveName: PlayerNameResolver,
) {
  return {
    totalRuns: innings.totalRuns,
    wickets: innings.wickets,
    overs: innings.overs,
    crr: innings.crr,
    rrr: innings.rrr,
    runsRemaining: innings.runsRemaining,
    ballsRemaining: innings.ballsRemaining,
    isCompleted: innings.isCompleted,
    completionReason: innings.completionReason,
    batters: withPlayerNames(innings.batters, resolveName),
    strikerId: innings.strikerId,
    nonStrikerId: innings.nonStrikerId,
    extras: innings.extras,
  }
}

export function bowlingSummary(
  innings: InningsState,
  resolveName: PlayerNameResolver,
) {
  return withPlayerNames(innings.bowlers, resolveName)
}

export function currentPartnershipSummary(
  innings: InningsState,
  resolveName: PlayerNameResolver,
) {
  const p = innings.currentPartnership
  if (!p || (p.runs === 0 && p.balls === 0)) return null
  return {
    ...p,
    batters: p.batters.map((id) => ({ id, name: resolveName(id) })),
  }
}

export function matchResultSummary(match: MatchState): string | null {
  return match.resultSummary
}
