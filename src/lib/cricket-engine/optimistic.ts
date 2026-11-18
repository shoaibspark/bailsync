// lib/cricket-engine/optimistic.ts
// Pure helpers for optimistically applying / rolling back deliveries on the
// client using the deterministic engine, so the UI updates instantly while the
// server round trip happens in the background.

import type {
  BallEventInput,
  InningsState,
  MatchConfig,
  MatchState,
} from "./types"
import { computeInningsState } from "./reducer"

function inningsSetupFrom(innings: InningsState): Parameters<typeof computeInningsState>[1] {
  return {
    inningsNumber: innings.inningsNumber,
    inningsId: innings.inningsId,
    battingClubId: innings.battingClubId,
    battingClubName: innings.battingClubName,
    bowlingClubId: innings.bowlingClubId,
    bowlingClubName: innings.bowlingClubName,
    targetRuns: innings.targetRuns,
    playingXI: innings.playingXI,
    bowlingXI: innings.bowlingXI,
    isSuperOver: innings.isSuperOver,
  }
}

function currentInningsOf(state: MatchState): InningsState | null {
  if (state.currentInningsNumber === 1) return state.innings1
  if (state.currentInningsNumber === 2) return state.innings2
  if (state.currentInningsNumber === 3) return state.superOver1
  return state.superOver2
}

function setCurrentInnings(state: MatchState, innings: InningsState): MatchState {
  const next = { ...state }
  if (state.currentInningsNumber === 1) next.innings1 = innings
  else if (state.currentInningsNumber === 2) next.innings2 = innings
  else if (state.currentInningsNumber === 3) next.superOver1 = innings
  else next.superOver2 = innings
  return next
}

/**
 * Recompute the current innings from the authoritative server events, minus any
 * optimistically deleted events (by sequenceNumber), plus any pending
 * optimistic additions.
 */
export function computeDisplayState(
  state: MatchState,
  options: { adds?: BallEventInput[]; deletes?: Set<number>; matchConfig?: MatchConfig },
): MatchState {
  const innings = currentInningsOf(state)
  if (!innings) return state
  const config = options.matchConfig ?? state.matchConfig
  const adds = options.adds ?? []
  const deletes = options.deletes ?? new Set<number>()
  const events = [...innings.events]
    .filter((e) => !deletes.has(e.sequenceNumber))
    .concat(adds)
  const next = computeInningsState(config, inningsSetupFrom(innings), events)
  return setCurrentInnings(state, next)
}

/** Build a `BallEventInput` for the next delivery, continuing the sequence. */
export function nextEvent(
  lastSeq: number,
  inningsId: string,
  payload: Omit<BallEventInput, "sequenceNumber">,
): BallEventInput {
  return { sequenceNumber: lastSeq + 1, ...payload }
}
