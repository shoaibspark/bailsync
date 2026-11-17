// lib/cricket-engine/reducer.ts
// Pure, deterministic cricket state machine. No I/O, no Date.now(), no randomness.
// Input: matchConfig, inningsSetup, ballEvents[] (immutable, ordered by sequenceNumber).
// Output: InningsState (fully recomputed from the stream every call).

import type {
  BallEventInput,
  BowlerStat,
  BatterStat,
  ExtraType,
  FallOfWicket,
  InningsState,
  InningsSetup,
  MatchConfig,
  OverBall,
  OverTimeline,
  Partnership,
  StoredBallEvent,
  WicketType,
} from "./types"

const NON_LEGAL_EXTRA_TYPES: ExtraType[] = ["WIDE", "NO_BALL", "PENALTY"]

const BOWLER_CREDIT_WICKET_TYPES: WicketType[] = [
  "BOWLED",
  "CAUGHT",
  "LBW",
  "STUMPED",
  "HIT_WICKET",
]

export function computeInningsState(
  matchConfig: MatchConfig,
  inningsSetup: InningsSetup,
  rawEvents: BallEventInput[],
): InningsState {
  const { oversPerInnings, maxOversPerBowler, ballsPerOver, wideRuns, noBallRuns, lastManStands } = matchConfig
  const {
    inningsNumber,
    inningsId = "",
    battingClubId,
    battingClubName = "",
    bowlingClubId,
    bowlingClubName = "",
    targetRuns,
    playingXI,
    bowlingXI = [],
    isSuperOver = false,
  } = inningsSetup

  // Filter out soft-deleted events, sort by sequenceNumber (stable).
  const events = rawEvents
    .filter((e) => !e.deletedAt)
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber)

  const playerIndex = new Map<string, number>()
  playingXI.forEach((pid, i) => playerIndex.set(pid, i))
  // ---- Running accumulators ----
  let totalRuns = 0
  let wickets = 0
  let legalBalls = 0
  let ballsThisOver = 0
  let overNumber = 0

  let strikerId: string | null = playingXI[0] ?? null
  let nonStrikerId: string | null = playingXI[1] ?? null

  const batterStats = new Map<string, BatterStatAccumulator>()
  const bowlerStats = new Map<string, BowlerStatAccumulator>()

  const inningsBalls: OverBall[] = [] // in stream order (derived overNumber/ballInOver)
  const oversTimeline: OverTimeline[] = []
  const fallOfWickets: FallOfWicket[] = []

  const extras = { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0, total: 0 }

  let currentBowlerId: string | null = null
  let previousBowlerId: string | null = null

  let isCompleted = false
  let completionReason: InningsState["completionReason"] = "none"
  let targetChased = false

  let currentPartnership = new PartnershipAccumulator(
    strikerId ?? "",
    nonStrikerId ?? "",
  )
  const completedPartnerships: Partnership[] = []

  // ---- Helpers ----

  function getBatter(pid: string): BatterStatAccumulator {
    let s = batterStats.get(pid)
    if (!s) {
      s = { playerId: pid, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, dismissal: null }
      batterStats.set(pid, s)
    }
    return s
  }

  function getBowler(pid: string): BowlerStatAccumulator {
    let s = bowlerStats.get(pid)
    if (!s) {
      s = {
        playerId: pid,
        legalBalls: 0,
        legalBallsThisOver: 0,
        runsConceded: 0,
        wickets: 0,
        wides: 0,
        noBalls: 0,
        maidens: 0,
        maidenRunsThisOver: 0,
      }
      bowlerStats.set(pid, s)
    }
    return s
  }

  function bowlerOversString(balls: number): string {
    const o = Math.floor(balls / ballsPerOver)
    const b = balls % ballsPerOver
    return `${o}.${b}`
  }

  function isOverComplete(): boolean {
    return ballsThisOver >= ballsPerOver
  }

  function isInningsOverLimit(): boolean {
    return overNumber >= oversPerInnings
  }

  function maxOversReached(bowlerId: string): boolean {
    const b = bowlerStats.get(bowlerId)
    if (!b) return false
    return b.legalBalls >= maxOversPerBowler * ballsPerOver
  }

  function allOut(): boolean {
    if (playingXI.length === 0) return false
    const needed = lastManStands ? playingXI.length : playingXI.length - 1
    return wickets >= needed
  }

  function nextAvailableBatter(): string | null {
    for (const pid of playingXI) {
      if (pid === strikerId || pid === nonStrikerId) continue
      const stat = batterStats.get(pid)
      if (stat?.isOut) continue
      return pid
    }
    return null
  }

  function targetReached(): boolean {
    return targetRuns !== undefined && totalRuns >= targetRuns
  }

  function finalizeOver(): void {
    // complete the current over timeline entry
    const overBalls = inningsBalls.filter((b) => b.overNumber === overNumber)
    const runs = overBalls.reduce((s, b) => s + b.runsScored + b.extraRuns, 0)
    const wk = overBalls.filter((b) => b.isWicket).length
    oversTimeline.push({ overNumber, balls: [...overBalls], runs, wickets: wk })

    // maiden: completed legal over with zero runs charged to the bowler
    const bowl = currentBowlerId ? bowlerStats.get(currentBowlerId) : null
    if (bowl && bowl.legalBallsThisOver > 0 && bowl.maidenRunsThisOver === 0) {
      bowl.maidens += 1
    }
    bowl && (bowl.maidenRunsThisOver = 0)

    // rotate strike at end of every legal over
    ;[strikerId, nonStrikerId] = [nonStrikerId, strikerId]
    previousBowlerId = currentBowlerId
    currentBowlerId = null
    ballsThisOver = 0
    overNumber += 1
  }

  function closeInnings(reason: InningsState["completionReason"]): void {
    if (isCompleted) return
    isCompleted = true
    completionReason = reason
    currentPartnership.finalize()
    if (currentPartnership.runs > 0 || currentPartnership.balls > 0) {
      completedPartnerships.push(currentPartnership.build())
    }
    currentPartnership.clear()
  }

  function processBall(event: BallEventInput): void {
    const {
      strikerId: sId,
      nonStrikerId: nId,
      bowlerId: bId,
      runsScored,
      extraType,
      extraRuns,
      isWicket,
      wicketType,
      dismissedPlayerId,
      fielderId,
    } = event

    // Determine current over/ball
    if (ballsThisOver === 0 && overNumber === 0) {
      overNumber = 1
    }
    if (isOverComplete() && !isCompleted) {
      finalizeOver()
      ballsThisOver = 0
      currentBowlerId = null
    }
    if (!currentBowlerId) currentBowlerId = bId

    const ballInOver = ballsThisOver + 1
    const isLegal = !NON_LEGAL_EXTRA_TYPES.includes(extraType)

    // striker/non-striker for this ball
    const thisStriker = sId ?? strikerId
    const thisNonStriker = nId ?? nonStrikerId
    strikerId = thisStriker
    nonStrikerId = thisNonStriker

    // ---- Runs accounting ----
    const batRuns = runsScored
    const widePenalty = extraType === "WIDE" ? wideRuns : 0
    const nbPenalty = extraType === "NO_BALL" ? noBallRuns : 0

    totalRuns += batRuns + extraRuns

    // extras breakdown
    if (extraType === "WIDE") {
      extras.wides += extraRuns
    } else if (extraType === "NO_BALL") {
      extras.noBalls += extraRuns
    } else if (extraType === "BYE") {
      extras.byes += extraRuns
    } else if (extraType === "LEG_BYE") {
      extras.legByes += extraRuns
    } else if (extraType === "PENALTY") {
      extras.penalty += extraRuns
    }
    extras.total = extras.wides + extras.noBalls + extras.byes + extras.legByes + extras.penalty

    if (isLegal && extraType !== "BYE" && extraType !== "LEG_BYE") {
      const bs = getBatter(thisStriker)
      bs.balls += 1
      bs.runs += batRuns
      if (batRuns === 4) bs.fours += 1
      if (batRuns === 6) bs.sixes += 1
    }
    if (extraType === "NO_BALL") {
      const bs = getBatter(thisStriker)
      bs.balls += 1
      bs.runs += batRuns
      if (batRuns === 4) bs.fours += 1
      if (batRuns === 6) bs.sixes += 1
    }

    // bowler credit
    const b = getBowler(bId)
    if (isLegal) {
      b.legalBalls += 1
      b.legalBallsThisOver += 1
      b.runsConceded += batRuns
    } else if (extraType === "NO_BALL") {
      b.noBalls += 1
      b.runsConceded += batRuns + nbPenalty
      b.maidenRunsThisOver += batRuns + nbPenalty
    } else if (extraType === "WIDE") {
      b.wides += 1
      b.runsConceded += widePenalty
      b.maidenRunsThisOver += widePenalty
    }
    // Byes/leg-byes/penalty not charged to bowler

    // ---- Wickets ----
    if (isWicket) {
      wickets += 1
      const dismissed = dismissedPlayerId ?? thisStriker
      const ds = getBatter(dismissed)
      ds.isOut = true
      ds.dismissal = {
        how: wicketType ?? null,
        bowler: BOWLER_CREDIT_WICKET_TYPES.includes(wicketType as WicketType) ? bId : null,
        fielder: fielderId ?? null,
      }

      fallOfWickets.push({
        wicket: wickets,
        score: totalRuns,
        overs: bowlerOversString(legalBalls),
        batter: dismissed,
        batterRuns: ds.runs,
        bowler: BOWLER_CREDIT_WICKET_TYPES.includes(wicketType as WicketType) ? bId : null,
        how: wicketType as WicketType,
      })

      if (BOWLER_CREDIT_WICKET_TYPES.includes(wicketType as WicketType)) {
        const bowlerStat = bowlerStats.get(bId)
        if (bowlerStat) bowlerStat.wickets += 1
      }

      currentPartnership.finalize()
      completedPartnerships.push(currentPartnership.build())

      // incoming batter takes dismissed batter's end
      const incoming = event.incomingBatterId ?? nextAvailableBatter()
      if (incoming && playingXI.includes(incoming)) {
        if (dismissed === thisStriker) {
          strikerId = incoming
        } else {
          nonStrikerId = incoming
        }
      } else if (dismissed === thisStriker) {
        strikerId = null
      } else {
        nonStrikerId = null
      }

      // start a new partnership with the batters now at the crease
      if (strikerId && nonStrikerId) {
        currentPartnership = new PartnershipAccumulator(strikerId, nonStrikerId)
      }
    } else {
      // strike rotation on odd runs physically run
      const runsRun = computeRunsRun(event)
      if (runsRun % 2 === 1) {
        ;[strikerId, nonStrikerId] = [nonStrikerId, strikerId]
      } else {
        strikerId = thisStriker
        nonStrikerId = thisNonStriker
      }
    }

    // record ball
    const derivedOver = overNumber
    const derivedBall = ballInOver
    inningsBalls.push({
      sequenceNumber: event.sequenceNumber,
      overNumber: derivedOver,
      ballInOver: derivedBall,
      isLegal,
      runsScored: batRuns,
      extraType,
      extraRuns,
      isWicket,
      wicketType,
      commentaryText: event.commentaryText,
    })

    legalBalls += isLegal ? 1 : 0
    ballsThisOver += isLegal ? 1 : 0

    // partnership tracking (legal balls only count toward partnership balls; runs count all)
    // Skip wicket balls: the partnership is already finalized at the wicket.
    if (!isWicket) {
      currentPartnership.addBall(batRuns + extraRuns, isLegal, thisStriker)
    }

    // check over end
    if (isOverComplete() && !isCompleted) {
      finalizeOver()
    }

    // check innings end
    if (allOut() && !isCompleted) {
      closeInnings("all_out")
    } else if (isInningsOverLimit() && !isCompleted) {
      closeInnings("overs_done")
    } else if (targetReached() && !isCompleted) {
      closeInnings("target_chased")
      targetChased = true
    }
  }

  function computeRunsRun(event: BallEventInput): number {
    const { runsScored, extraType, extraRuns } = event
    if (extraType === "WIDE" || extraType === "NO_BALL") {
      // runs run = extraRuns - penalty
      return Math.max(0, extraRuns - (extraType === "WIDE" ? wideRuns : noBallRuns))
    }
    return runsScored
  }

  // ---- Process all events ----
  for (const event of events) {
    if (isCompleted) break
    processBall(event)
  }

  // finalize any open (incomplete) over for the timeline, without rotating strike
  if (ballsThisOver > 0 && !isCompleted) {
    const overBalls = inningsBalls.filter((b) => b.overNumber === overNumber)
    const runs = overBalls.reduce((s, b) => s + b.runsScored + b.extraRuns, 0)
    const wk = overBalls.filter((b) => b.isWicket).length
    oversTimeline.push({ overNumber, balls: [...overBalls], runs, wickets: wk })
  }

  // ---- Build output ----

  const batters: BatterStat[] = playingXI.map((pid) => {
    const s = batterStats.get(pid)
    const dismissed = s?.isOut
    return {
      playerId: pid,
      name: "", // filled by caller/selectors
      runs: s?.runs ?? 0,
      balls: s?.balls ?? 0,
      fours: s?.fours ?? 0,
      sixes: s?.sixes ?? 0,
      strikeRate: s?.balls ? Math.round((s.runs / s.balls) * 100) : 0,
      isOut: dismissed ?? false,
      isOnStrike: pid === strikerId,
      dismissal: s?.dismissal ?? null,
    }
  })

  const bowlers: BowlerStat[] = Array.from(bowlerStats.values()).map((b) => {
    const oversStr = bowlerOversString(b.legalBalls)
    return {
      playerId: b.playerId,
      name: "",
      overs: oversStr,
      ballsBowled: b.legalBalls,
      maidens: b.maidens,
      runsConceded: b.runsConceded,
      wickets: b.wickets,
      economy: b.legalBalls ? Math.round((b.runsConceded / (b.legalBalls / 6)) * 100) / 100 : 0,
      wides: b.wides,
      noBalls: b.noBalls,
      isCurrent: b.playerId === currentBowlerId,
      atMaxOvers: maxOversReached(b.playerId),
    }
  })

  const oversDecimal = legalBalls / ballsPerOver
  const ballsFaced = inningsBalls.filter((b) => b.isLegal).length
  const oversBowled = ballsFaced / ballsPerOver
  const crr = oversBowled > 0 ? Math.round((totalRuns / oversBowled) * 100) / 100 : 0

  let rrr = 0
  let runsRemaining = 0
  let ballsRemaining = 0
  if (targetRuns !== undefined) {
    runsRemaining = Math.max(0, targetRuns - totalRuns)
    const ballsLeft = oversPerInnings * ballsPerOver - legalBalls
    ballsRemaining = Math.max(0, ballsLeft)
    rrr = ballsLeft > 0 ? Math.round((runsRemaining / (ballsLeft / 6)) * 100) / 100 : 0
  }

  const runsPerOver = oversTimeline.map((o) => o.runs)

  return {
    inningsNumber,
    inningsId,
    battingClubId,
    battingClubName,
    bowlingClubId,
    bowlingClubName,
    targetRuns,
    playingXI: [...playingXI],
    bowlingXI: [...bowlingXI],
    isSuperOver,
    lastSequenceNumber: events.at(-1)?.sequenceNumber ?? 0,
    totalRuns,
    wickets,
    legalBalls,
    overs: bowlerOversString(legalBalls),
    oversDecimal,
    ballsRemaining,
    crr,
    rrr,
    runsRemaining,
    isCompleted,
    completionReason,
    extras,
    batters,
    strikerId,
    nonStrikerId,
    bowlers,
    currentBowlerId,
    previousBowlerId,
    currentPartnership: currentPartnership.build(),
    completedPartnerships,
    fallOfWickets,
    oversTimeline,
    runsPerOver,
    targetChased,
  }
}

// ---- accumulators ----

interface BatterStatAccumulator {
  playerId: string
  runs: number
  balls: number
  fours: number
  sixes: number
  isOut: boolean
  dismissal: { how: WicketType | null; bowler: string | null; fielder: string | null } | null
}

interface BowlerStatAccumulator {
  playerId: string
  legalBalls: number
  legalBallsThisOver: number
  runsConceded: number
  wickets: number
  wides: number
  noBalls: number
  maidens: number
  maidenRunsThisOver: number
}

class PartnershipAccumulator {
  batters: [string, string]
  runs = 0
  balls = 0
  contributions: Record<string, { runs: number; balls: number }> = {}
  private active = true

  constructor(b1: string, b2: string) {
    this.batters = [b1, b2]
    this.contributions[b1] = { runs: 0, balls: 0 }
    this.contributions[b2] = { runs: 0, balls: 0 }
  }

  addBall(runs: number, isLegal: boolean, striker: string): void {
    if (!this.active) return
    this.runs += runs
    if (isLegal) this.balls += 1
    this.contributions[striker] = this.contributions[striker] || { runs: 0, balls: 0 }
    this.contributions[striker].runs += runs
    if (isLegal) this.contributions[striker].balls += 1
  }

  finalize(): void {
    this.active = false
  }

  clear(): void {
    this.active = false
  }

  build(): Partnership {
    return {
      batters: this.batters as [string, string],
      runs: this.runs,
      balls: this.balls,
      contributions: this.contributions,
    }
  }
}

// ---- Match-level combination ----

export interface InningsInput {
  inningsNumber: number
  inningsId?: string
  matchId: string
  battingClubId: string
  battingClubName?: string
  bowlingClubId: string
  bowlingClubName?: string
  targetRuns?: number
  playingXI: string[]
  bowlingXI?: string[]
  events: StoredBallEvent[]
  isSuperOver?: boolean
}

export interface MatchStateMetadata {
  homeClub?: import("./types").ClubSummary | null
  awayClub?: import("./types").ClubSummary | null
  playerNames?: Record<string, string>
}

export function computeMatchState(
  matchId: string,
  inningsList: InningsInput[],
  matchConfig: MatchConfig,
  metadata: MatchStateMetadata = {},
): import("./types").MatchState {
  const inningsMap = new Map<number, import("./types").InningsState | null>()

  for (const inn of inningsList.sort((a, b) => a.inningsNumber - b.inningsNumber)) {
    const state = computeInningsState(
      matchConfig,
      {
        inningsNumber: inn.inningsNumber,
        inningsId: inn.inningsId,
        battingClubId: inn.battingClubId,
        battingClubName: inn.battingClubName,
        bowlingClubId: inn.bowlingClubId,
        bowlingClubName: inn.bowlingClubName,
        targetRuns: inn.targetRuns,
        playingXI: inn.playingXI,
        bowlingXI: inn.bowlingXI,
        isSuperOver: inn.isSuperOver,
      },
      inn.events.map((e) => ({
        sequenceNumber: e.sequenceNumber,
        overNumber: e.overNumber,
        ballInOver: e.ballInOver,
        strikerId: e.strikerId,
        nonStrikerId: e.nonStrikerId,
        bowlerId: e.bowlerId,
        runsScored: e.runsScored,
        extraType: e.extraType,
        extraRuns: e.extraRuns,
        isWicket: e.isWicket,
        wicketType: e.wicketType,
        dismissedPlayerId: e.dismissedPlayerId,
        fielderId: e.fielderId,
        incomingBatterId: e.incomingBatterId,
        deletedAt: e.deletedAt,
        wagonWheelZone: e.wagonWheelZone,
        commentaryText: e.commentaryText,
      })),
    )
    inningsMap.set(inn.inningsNumber, state)
  }

  const orderedStates = [...inningsMap.entries()]
    .filter((entry): entry is [number, import("./types").InningsState] => entry[1] !== null)
    .sort(([a], [b]) => a - b)
  const currentState = orderedStates.find(([, state]) => !state.isCompleted)?.[1] ?? orderedStates[0]?.[1] ?? null
  const currentInningsNumber = currentState?.inningsNumber ?? 1
  const currentInningsId = currentState?.inningsId || null

  const innings1 = inningsMap.get(1) ?? null
  const innings2 = inningsMap.get(2) ?? null
  const superOver1 = inningsMap.get(3) ?? null
  const superOver2 = inningsMap.get(4) ?? null

  // Determine result
  let resultType: import("./types").MatchState["resultType"] = "none"
  let resultSummary: string | null = null
  let winnerClubId: string | null = null

  if (innings1?.isCompleted && innings2?.isCompleted) {
    const i1Runs = innings1.totalRuns
    const i2Runs = innings2.totalRuns
    const i2Wickets = innings2.wickets

    if (i1Runs === i2Runs) {
      resultType = "tie"
      resultSummary = "Match tied"
    } else if (i2Runs > i1Runs) {
      resultType = "win_wickets"
      const wicketsRemaining = (innings2.batters.length - 1) - i2Wickets
      resultSummary = `${innings2.battingClubName || innings2.battingClubId} won by ${wicketsRemaining} wickets`
      winnerClubId = innings2.battingClubId
    } else {
      resultType = "win_runs"
      resultSummary = `${innings1.battingClubName || innings1.battingClubId} won by ${i1Runs - i2Runs} runs`
      winnerClubId = innings1.battingClubId
    }
  }

  return {
    matchId,
    matchConfig,
    homeClub: metadata.homeClub ?? null,
    awayClub: metadata.awayClub ?? null,
    playerNames: metadata.playerNames ?? {},
    innings1,
    innings2,
    superOver1,
    superOver2,
    targetRuns: innings2?.targetRuns,
    resultType,
    resultSummary,
    winnerClubId,
    currentInningsNumber,
    currentInningsId,
  }
}
