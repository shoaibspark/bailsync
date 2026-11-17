// lib/cricket-engine/validateEventStream.ts
// Validates a ball event stream for internal consistency.
// Returns a list of issues (errors and warnings). Does not modify data.

import type {
  BallEventInput,
  ExtraType,
  MatchConfig,
  ValidationIssue,
} from "./types"

const NON_LEGAL: ExtraType[] = ["WIDE", "NO_BALL"]

export function validateEventStream(
  events: BallEventInput[],
  config: MatchConfig,
  playingXI: string[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const sorted = [...events]
    .filter((e) => !e.deletedAt)
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber)

  const batterCrease = new Map<string, boolean>() // playerId -> is batting
  const bowlerBalls = new Map<string, number>() // bowler -> legal balls bowled
  const outPlayers = new Set<string>()

  // openers start
  if (playingXI[0]) batterCrease.set(playingXI[0], true)
  if (playingXI[1]) batterCrease.set(playingXI[1], true)

  let overNumber = 0
  let ballsThisOver = 0

  for (const e of sorted) {
    const seq = e.sequenceNumber
    const { strikerId, nonStrikerId, bowlerId, extraType, isWicket, wicketType, dismissedPlayerId } = e

    // over/ball derivation check
    if (ballsThisOver === 0 && overNumber === 0) overNumber = 1
    const expectedBall = ballsThisOver + 1
    if (e.ballInOver !== undefined && e.ballInOver !== expectedBall) {
      issues.push({
        sequenceNumber: seq,
        overNumber: e.overNumber ?? overNumber,
        ballInOver: e.ballInOver ?? expectedBall,
        type: "warning",
        message: `ballInOver ${e.ballInOver} does not match derived ${expectedBall}`,
      })
    }
    if (e.overNumber !== undefined && e.overNumber !== overNumber) {
      issues.push({
        sequenceNumber: seq,
        overNumber: e.overNumber,
        ballInOver: expectedBall,
        type: "warning",
        message: `overNumber ${e.overNumber} does not match derived ${overNumber}`,
      })
    }

    // striker must be batting
    if (strikerId && !batterCrease.get(strikerId)) {
      issues.push({
        sequenceNumber: seq,
        overNumber: overNumber,
        ballInOver: expectedBall,
        type: "error",
        message: `Striker ${strikerId} is not currently batting`,
      })
    }
    if (nonStrikerId && !batterCrease.get(nonStrikerId)) {
      issues.push({
        sequenceNumber: seq,
        overNumber: overNumber,
        ballInOver: expectedBall,
        type: "error",
        message: `Non-striker ${nonStrikerId} is not currently batting`,
      })
    }

    // bowler at max overs (legal balls)
    const bowled = (bowlerBalls.get(bowlerId) ?? 0)
    if (bowled >= config.maxOversPerBowler * config.ballsPerOver) {
      issues.push({
        sequenceNumber: seq,
        overNumber: overNumber,
        ballInOver: expectedBall,
        type: "error",
        message: `Bowler ${bowlerId} has reached max overs`,
      })
    }

    // wicket consistency
    if (isWicket) {
      if (!wicketType) {
        issues.push({
          sequenceNumber: seq,
          overNumber: overNumber,
          ballInOver: expectedBall,
          type: "error",
          message: "Wicket event missing wicketType",
        })
      }
      const dismissed = dismissedPlayerId ?? strikerId
      if (!batterCrease.get(dismissed)) {
        issues.push({
          sequenceNumber: seq,
          overNumber: overNumber,
          ballInOver: expectedBall,
          type: "error",
          message: `Dismissed player ${dismissed} is not batting`,
        })
      }
      // wide/noball valid wickets
      if (extraType === "WIDE" && wicketType && !["STUMPED", "RUN_OUT", "HIT_WICKET", "OBSTRUCTING_FIELD"].includes(wicketType)) {
        issues.push({ sequenceNumber: seq, overNumber: overNumber, ballInOver: expectedBall, type: "error", message: `Wicket type ${wicketType} invalid on a wide` })
      }
      if (extraType === "NO_BALL" && wicketType && !["RUN_OUT", "OBSTRUCTING_FIELD"].includes(wicketType)) {
        issues.push({ sequenceNumber: seq, overNumber: overNumber, ballInOver: expectedBall, type: "error", message: `Wicket type ${wicketType} invalid on a no-ball` })
      }
    }

    // wide/noball runs sanity
    if (extraType === "WIDE" && e.extraRuns < 1) {
      issues.push({ sequenceNumber: seq, overNumber: overNumber, ballInOver: expectedBall, type: "warning", message: "Wide with less than 1 extra run" })
    }
    if (extraType === "NO_BALL" && e.extraRuns < 1) {
      issues.push({ sequenceNumber: seq, overNumber: overNumber, ballInOver: expectedBall, type: "warning", message: "No ball with less than 1 extra run" })
    }

    // track legal balls for bowler
    if (!NON_LEGAL.includes(extraType)) {
      bowlerBalls.set(bowlerId, (bowlerBalls.get(bowlerId) ?? 0) + 1)
      ballsThisOver += 1
    }

    // end of over
    if (ballsThisOver >= config.ballsPerOver) {
      ballsThisOver = 0
      overNumber += 1
      // rotate strike at end of over
      if (strikerId && nonStrikerId) {
        batterCrease.set(strikerId, false)
        batterCrease.set(nonStrikerId, false)
        batterCrease.set(strikerId, true)
        batterCrease.set(nonStrikerId, true)
        // swap crease ends (rotation handled by reducer; here just ensure both still batting)
      }
    }

    // update batting state on wicket
    if (isWicket && dismissedPlayerId) {
      batterCrease.set(dismissedPlayerId, false)
      outPlayers.add(dismissedPlayerId)
    }
  }

  return issues
}
