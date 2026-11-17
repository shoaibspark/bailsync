// lib/cricket-engine/types.ts
// Pure types for the event-sourced cricket engine. No I/O here.

export type PlayerId = string
export type ClubId = string

export type WicketType =
  | "BOWLED"
  | "CAUGHT"
  | "LBW"
  | "RUN_OUT"
  | "STUMPED"
  | "HIT_WICKET"
  | "RETIRED_HURT"
  | "RETIRED_OUT"
  | "OBSTRUCTING_FIELD"
  | "TIMED_OUT"

export type ExtraType = "NONE" | "WIDE" | "NO_BALL" | "BYE" | "LEG_BYE" | "PENALTY"

export interface MatchConfig {
  oversPerInnings: number
  maxOversPerBowler: number
  ballsPerOver: number
  wideRuns: number
  noBallRuns: number
  lastManStands: boolean
}

export interface InningsSetup {
  inningsNumber: number
  inningsId?: string
  battingClubId: ClubId
  bowlingClubId: ClubId
  battingClubName?: string
  bowlingClubName?: string
  targetRuns?: number // innings 2+ (and Super Over)
  playingXI: PlayerId[] // batting order
  bowlingXI?: PlayerId[]
  isSuperOver?: boolean
}

export interface BallEventInput {
  sequenceNumber: number
  // overNumber / ballInOver are derived by the reducer; accepted but ignored
  overNumber?: number
  ballInOver?: number
  strikerId: PlayerId
  nonStrikerId: PlayerId
  bowlerId: PlayerId
  runsScored: number // off the bat
  extraType: ExtraType
  extraRuns: number // total extras incl. penalty
  isWicket: boolean
  wicketType?: WicketType
  dismissedPlayerId?: PlayerId
  fielderId?: PlayerId
  incomingBatterId?: PlayerId // new batter after a wicket
  deletedAt?: Date | null
  wagonWheelZone?: number
  commentaryText?: string
}

export interface StoredBallEvent extends BallEventInput {
  id: string
  inningsId: string
  createdAt: Date
  updatedAt: Date
}

export interface BatterStat {
  playerId: PlayerId
  name: string
  runs: number
  balls: number
  fours: number
  sixes: number
  strikeRate: number
  isOut: boolean
  isOnStrike: boolean
  dismissal: {
    how: WicketType | null
    bowler: PlayerId | null
    fielder: PlayerId | null
  } | null
}

export interface BowlerStat {
  playerId: PlayerId
  name: string
  overs: string // x.y
  ballsBowled: number // legal balls
  maidens: number
  runsConceded: number
  wickets: number
  economy: number
  wides: number
  noBalls: number
  isCurrent: boolean
  atMaxOvers: boolean
}

export interface Partnership {
  batters: [PlayerId, PlayerId]
  runs: number
  balls: number
  contributions: Record<PlayerId, { runs: number; balls: number }>
}

export interface FallOfWicket {
  wicket: number // 1-indexed
  score: number // total runs at fall
  overs: string // x.y
  batter: PlayerId
  batterRuns: number
  bowler: PlayerId | null
  how: WicketType
}

export interface OverBall {
  sequenceNumber: number
  overNumber: number
  ballInOver: number
  isLegal: boolean
  runsScored: number
  extraType: ExtraType
  extraRuns: number
  isWicket: boolean
  wicketType?: WicketType
  commentaryText?: string
}

export interface OverTimeline {
  overNumber: number
  balls: OverBall[]
  runs: number
  wickets: number
}

export interface InningsState {
  inningsNumber: number
  inningsId: string
  battingClubId: ClubId
  battingClubName: string
  bowlingClubId: ClubId
  bowlingClubName: string
  targetRuns?: number
  playingXI: PlayerId[]
  bowlingXI: PlayerId[]
  isSuperOver: boolean
  lastSequenceNumber: number

  // Totals
  totalRuns: number
  wickets: number
  legalBalls: number
  overs: string // x.y
  oversDecimal: number
  ballsRemaining: number
  crr: number // current run rate
  rrr: number // required run rate (innings 2+)
  runsRemaining: number
  isCompleted: boolean
  completionReason: "none" | "all_out" | "overs_done" | "target_chased" | "declared"

  // Extras breakdown
  extras: {
    wides: number
    noBalls: number
    byes: number
    legByes: number
    penalty: number
    total: number
  }

  // Batters
  batters: BatterStat[]
  strikerId: PlayerId | null
  nonStrikerId: PlayerId | null

  // Bowlers
  bowlers: BowlerStat[]
  currentBowlerId: PlayerId | null
  previousBowlerId: PlayerId | null

  // Partnerships
  currentPartnership: Partnership | null
  completedPartnerships: Partnership[]

  // FoW
  fallOfWickets: FallOfWicket[]

  // Timeline
  oversTimeline: OverTimeline[]
  runsPerOver: number[] // for Manhattan chart

  // Innings 2 chase
  targetChased: boolean
}

export interface ClubSummary {
  id: ClubId
  name: string
  shortName: string | null
}

export interface MatchState {
  matchId: string
  matchConfig: MatchConfig
  homeClub: ClubSummary | null
  awayClub: ClubSummary | null
  playerNames: Record<PlayerId, string>
  innings1: InningsState | null
  innings2: InningsState | null
  superOver1: InningsState | null
  superOver2: InningsState | null
  targetRuns?: number
  resultType: "none" | "win_runs" | "win_wickets" | "tie" | "no_result" | "abandoned"
  resultSummary: string | null
  winnerClubId: ClubId | null
  currentInningsNumber: number
  currentInningsId: string | null
}

export interface ValidationIssue {
  sequenceNumber: number
  overNumber: number
  ballInOver: number
  type: "error" | "warning"
  message: string
}

export interface EngineDependencies {
  getPlayerName: (playerId: PlayerId) => string
}
