import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { computeInningsState, computeMatchState } from "./reducer"
import { validateEventStream } from "./validateEventStream"
import { encodeSseFrame, decodeSseFrame, encodeBody, decodeBody, contentType } from "../wire-codec"
import { computeStandings } from "../tournament/standings"
import { aggregatePlayerStats } from "../stats/player"

const config = {
  oversPerInnings: 20,
  maxOversPerBowler: 4,
  ballsPerOver: 6,
  wideRuns: 1,
  noBallRuns: 1,
  lastManStands: false,
}

function event(overrides: Record<string, any> = {}): any {
  return {
    sequenceNumber: overrides.sequenceNumber ?? 1,
    overNumber: overrides.overNumber ?? 1,
    ballInOver: overrides.ballInOver ?? 1,
    strikerId: overrides.strikerId ?? "s1",
    nonStrikerId: overrides.nonStrikerId ?? "s2",
    bowlerId: overrides.bowlerId ?? "b1",
    runsScored: overrides.runsScored ?? 0,
    extraType: overrides.extraType ?? "NONE",
    extraRuns: overrides.extraRuns ?? 0,
    isWicket: overrides.isWicket ?? false,
    wicketType: overrides.wicketType,
    dismissedPlayerId: overrides.dismissedPlayerId,
    fielderId: overrides.fielderId,
    incomingBatterId: overrides.incomingBatterId,
    deletedAt: overrides.deletedAt ?? null,
  }
}

const playingXI = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11"]

function state(events: any[], targetRuns?: number) {
  return computeInningsState(config, {
    inningsNumber: 1,
    battingClubId: "c1",
    bowlingClubId: "c2",
    targetRuns,
    playingXI,
  }, events)
}

describe("cricket engine", () => {
  it("wide with runs: 3 extras, not legal, no ball faced", () => {
    const s = state([event({ extraType: "WIDE", extraRuns: 3, runsScored: 0 })])
    expect(s.totalRuns).toBe(3)
    expect(s.extras.wides).toBe(3)
    expect(s.extras.total).toBe(3)
    expect(s.legalBalls).toBe(0)
    expect(s.overs).toBe("0.0")
    const st = s.batters.find((b: any) => b.playerId === "s1")
    expect(st?.balls).toBe(0)
    // strike rotates on wide+2 (runs run = 3 - 1 penalty = 2, even -> no rotate)
    expect(s.strikerId).toBe("s1")
  })

  it("no-ball with bat runs credited to batter and bowler, counts as faced", () => {
    const s = state([event({ extraType: "NO_BALL", extraRuns: 1, runsScored: 4 })])
    expect(s.totalRuns).toBe(5)
    expect(s.extras.noBalls).toBe(1)
    const st = s.batters.find((b: any) => b.playerId === "s1")
    expect(st?.runs).toBe(4)
    expect(st?.balls).toBe(1)
    // no-ball is not a legal delivery
    expect(s.legalBalls).toBe(0)
    const bw = s.bowlers.find((b: any) => b.playerId === "b1")
    expect(bw?.runsConceded).toBe(5)
  })

  it("no-ball run-out is a real wicket", () => {
    const s = state([
      event({
        extraType: "NO_BALL",
        extraRuns: 1,
        runsScored: 0,
        isWicket: true,
        wicketType: "RUN_OUT",
        dismissedPlayerId: "s2",
      }),
    ])
    expect(s.wickets).toBe(1)
    const st = s.batters.find((b: any) => b.playerId === "s2")
    expect(st?.isOut).toBe(true)
    const bw = s.bowlers.find((b: any) => b.playerId === "b1")
    expect(bw?.wickets).toBe(0)
  })

  it("strike rotation on odd runs", () => {
    const s = state([event({ runsScored: 1 })])
    expect(s.strikerId).toBe("s2")
    expect(s.nonStrikerId).toBe("s1")
  })

  it("no rotation on boundary", () => {
    const s = state([event({ runsScored: 4 })])
    expect(s.strikerId).toBe("s1")
  })

  it("wicket at the non-striker end keeps the striker on strike and brings in the next batter", () => {
    const s = state([
      event({
        runsScored: 0,
        isWicket: true,
        wicketType: "BOWLED",
        dismissedPlayerId: "s2",
      }),
    ])
    expect(s.wickets).toBe(1)
    expect(s.strikerId).toBe("s1")
    expect(s.nonStrikerId).toBe("s3")
    expect(s.batters.find((b: any) => b.playerId === "s2")?.isOut).toBe(true)
  })

  it("honours an explicitly selected incoming batter", () => {
    const s = state([
      event({
        runsScored: 0,
        isWicket: true,
        wicketType: "BOWLED",
        dismissedPlayerId: "s1",
        incomingBatterId: "s7",
      }),
    ])
    expect(s.strikerId).toBe("s7")
    expect(s.nonStrikerId).toBe("s2")
  })

  it("recorded strike positions are authoritative for each delivery", () => {
    const s = state([
      event({ sequenceNumber: 1, runsScored: 0 }),
      event({ sequenceNumber: 2, strikerId: "s2", nonStrikerId: "s1", runsScored: 0 }),
    ])
    expect(s.strikerId).toBe("s2")
    expect(s.nonStrikerId).toBe("s1")
  })

  it("rotation at end of over", () => {
    const events = []
    for (let i = 1; i <= 6; i++) events.push(event({ sequenceNumber: i, runsScored: 0 }))
    const s = state(events)
    expect(s.overs).toBe("1.0")
    expect(s.strikerId).toBe("s2")
  })

  it("wicket on last ball of over + end-of-over rotation handled", () => {
    const events = []
    for (let i = 1; i <= 5; i++) events.push(event({ sequenceNumber: i, runsScored: 0 }))
    events.push(
      event({
        sequenceNumber: 6,
        runsScored: 0,
        isWicket: true,
        wicketType: "BOWLED",
        dismissedPlayerId: "s1",
        incomingBatterId: "s3",
      }),
    )
    const s = state(events)
    expect(s.wickets).toBe(1)
    // wicket on last ball: incoming batter takes striker's end, then end-of-over
    // rotation swaps ends, so the non-striker (s2) ends up on strike
    expect(s.strikerId).toBe("s2")
    expect(s.nonStrikerId).toBe("s3")
    expect(s.overs).toBe("1.0")
  })

  it("byes and leg-byes are legal but not balls faced or charged to the bowler", () => {
    const s = state([event({ extraType: "BYE", extraRuns: 2, runsScored: 0 })])
    expect(s.totalRuns).toBe(2)
    expect(s.extras.byes).toBe(2)
    expect(s.legalBalls).toBe(1)
    const st = s.batters.find((b: any) => b.playerId === "s1")
    expect(st?.balls).toBe(0)
    const bw = s.bowlers.find((b: any) => b.playerId === "b1")
    expect(bw?.runsConceded).toBe(0)
  })

  it("penalty runs added to extras only, not a delivery", () => {
    const s = state([event({ extraType: "PENALTY", extraRuns: 5, runsScored: 0 })])
    expect(s.totalRuns).toBe(5)
    expect(s.extras.penalty).toBe(5)
    expect(s.legalBalls).toBe(0)
  })

  it("maiden detection", () => {
    const events = []
    for (let i = 1; i <= 6; i++) events.push(event({ sequenceNumber: i, runsScored: 0 }))
    const s = state(events)
    const bw = s.bowlers.find((b: any) => b.playerId === "b1")
    expect(bw?.maidens).toBe(1)
  })

  it("bowler overs formatting", () => {
    const events = []
    for (let i = 1; i <= 7; i++) {
      events.push(event({ sequenceNumber: i, runsScored: i === 7 ? 6 : 0 }))
    }
    const s = state(events)
    const bw = s.bowlers.find((b: any) => b.playerId === "b1")
    expect(bw?.overs).toBe("1.1")
  })

  it("CRR and RRR with target", () => {
    const s = state([
      event({ sequenceNumber: 1, runsScored: 4 }),
      event({ sequenceNumber: 2, runsScored: 0 }),
    ], 100)
    expect(s.crr).toBeGreaterThan(0)
    expect(s.runsRemaining).toBe(96)
  })

  it("wicket types and bowler credit rules", () => {
    const s = state([
      event({ sequenceNumber: 1, isWicket: true, wicketType: "RUN_OUT", dismissedPlayerId: "s1" }),
      event({ sequenceNumber: 2, isWicket: true, wicketType: "BOWLED", dismissedPlayerId: "s2" }),
    ])
    expect(s.wickets).toBe(2)
    const bw = s.bowlers.find((b: any) => b.playerId === "b1")
    expect(bw?.wickets).toBe(1)
  })

  it("fall of wickets and partnerships", () => {
    const s = state([
      event({ sequenceNumber: 1, runsScored: 4 }),
      event({ sequenceNumber: 2, isWicket: true, wicketType: "BOWLED", dismissedPlayerId: "s1", incomingBatterId: "s3" }),
    ])
    expect(s.fallOfWickets.length).toBe(1)
    expect(s.fallOfWickets[0].batter).toBe("s1")
    expect(s.completedPartnerships.length).toBe(1)
  })

  it("target chase completion", () => {
    const s = state([event({ sequenceNumber: 1, runsScored: 101 })], 100)
    expect(s.isCompleted).toBe(true)
    expect(s.completionReason).toBe("target_chased")
    expect(s.targetChased).toBe(true)
  })

  it("all out", () => {
    const events = []
    for (let w = 0; w < 10; w++) {
      events.push(
        event({
          sequenceNumber: w * 2 + 1,
          runsScored: 0,
          isWicket: true,
          wicketType: "BOWLED",
          dismissedPlayerId: playingXI[w],
          incomingBatterId: playingXI[w + 1] ?? undefined,
        }),
      )
      events.push(event({ sequenceNumber: w * 2 + 2, runsScored: 0 }))
    }
    const s = state(events)
    expect(s.isCompleted).toBe(true)
    expect(s.completionReason).toBe("all_out")
    expect(s.wickets).toBe(10)
  })

  it("undo removes last ball and recomputes", () => {
    const events = [
      event({ sequenceNumber: 1, runsScored: 4 }),
      event({ sequenceNumber: 2, runsScored: 0 }),
    ]
    const before = state(events)
    expect(before.totalRuns).toBe(4)
    const after = state([events[0]])
    expect(after.totalRuns).toBe(4)
    expect(after.wickets).toBe(0)
  })

  it("mid-over edit changes 1 -> 4", () => {
    const events = [
      event({ sequenceNumber: 1, runsScored: 1 }),
      event({ sequenceNumber: 2, runsScored: 0 }),
    ]
    const s = state(events)
    expect(s.totalRuns).toBe(1)
    const edited = [...events]
    edited[0].runsScored = 4
    const s2 = state(edited)
    expect(s2.totalRuns).toBe(4)
  })

  it("change wide -> legal ball recomputes fully", () => {
    const events = [
      event({ sequenceNumber: 1, extraType: "WIDE", extraRuns: 1, runsScored: 0 }),
      event({ sequenceNumber: 2, runsScored: 1 }),
    ]
    const s = state(events)
    expect(s.extras.wides).toBe(1)
    expect(s.legalBalls).toBe(1)
    const edited = [...events]
    edited[0].extraType = "NONE"
    edited[0].extraRuns = 0
    edited[0].runsScored = 2
    const s2 = state(edited)
    expect(s2.extras.wides).toBe(0)
    expect(s2.totalRuns).toBe(3)
    expect(s2.legalBalls).toBe(2)
  })

  it("determinism: same input -> same output", () => {
    const events = [
      event({ sequenceNumber: 1, runsScored: 4 }),
      event({ sequenceNumber: 2, extraType: "WIDE", extraRuns: 1 }),
    ]
    const a = state(events)
    const b = state(events)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it("validateEventStream catches invalid striker", () => {
    const issues = validateEventStream(
      [event({ sequenceNumber: 1, strikerId: "unknown", nonStrikerId: "s2" })],
      config,
      playingXI,
    )
    expect(issues.some((i: any) => i.type === "error")).toBe(true)
  })

  it("Super Over innings supported", () => {
    const s = computeInningsState(config, {
      inningsNumber: 3,
      battingClubId: "c1",
      bowlingClubId: "c2",
      playingXI,
      isSuperOver: true,
    }, [event({ sequenceNumber: 1, runsScored: 6 })])
    expect(s.isSuperOver).toBe(true)
    expect(s.totalRuns).toBe(6)
  })

  it("match state combines innings and produces result", () => {
    const match = computeMatchState("m1", [
      {
        inningsNumber: 1,
        matchId: "m1",
        battingClubId: "c1",
        bowlingClubId: "c2",
        targetRuns: 100,
        playingXI,
        events: [event({ sequenceNumber: 1, runsScored: 100 })],
      },
      {
        inningsNumber: 2,
        matchId: "m1",
        battingClubId: "c2",
        bowlingClubId: "c1",
        targetRuns: 101,
        playingXI: ["s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11", "s1", "s2"],
        events: [event({ sequenceNumber: 1, runsScored: 102 })],
      },
    ], config)
    expect(match.resultType).toBe("win_wickets")
    expect(match.winnerClubId).toBe("c2")
  })
})

describe("NRR / standings", () => {
  it("all-out rule: overs faced = full quota", () => {
    const standings = computeStandings({
      clubs: [
        { id: "c1", name: "Team A" },
        { id: "c2", name: "Team B" },
      ],
      matches: [
        {
          id: "m1",
          status: "COMPLETED",
          resultType: "WIN_WICKETS",
          winnerClubId: "c2",
          resultSummary: "Team B won",
          oversPerInnings: 20,
          innings: [
            {
              battingClubId: "c1",
              bowlingClubId: "c2",
              runs: 100,
              wickets: 10,
              legalBalls: 100,
              oversBowledByBowling: 16.5,
              isAllOut: true,
              targetChased: false,
              completed: true,
            },
            {
              battingClubId: "c2",
              bowlingClubId: "c1",
              runs: 101,
              wickets: 2,
              legalBalls: 72,
              oversBowledByBowling: 12.0,
              isAllOut: false,
              targetChased: true,
              targetRuns: 101,
              completed: true,
            },
          ],
        },
      ],
    })
    const a = standings.find((s: any) => s.clubId === "c1")
    expect(a?.oversFaced).toBe(20)
  })
})

describe("wire codec", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development")
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("encodeSseFrame JSON round-trip (dev mode)", () => {
    const frame = encodeSseFrame({ runs: 4 }, "ball")
    expect(frame).toContain("data: ")
    expect(frame).toContain('"runs":4')
    const parsed = decodeSseFrame(frame)
    expect(parsed.data).toEqual({ runs: 4 })
    expect(parsed.event).toBe("ball")
  })

  it("encodeBody / decodeBody round-trip", () => {
    const enc = encodeBody({ a: 1 })
    expect(enc.contentType).toBe("application/json")
    const dec = decodeBody(enc.contentType, enc.body as string)
    expect(dec).toEqual({ a: 1 })
  })

  it("contentType returns application/json in dev", () => {
    expect(contentType()).toBe("application/json")
  })
})

describe("player stats aggregation", () => {
  it("aggregates batting and bowling career", () => {
    const stats = aggregatePlayerStats("p1", "Player One", [
      {
        batting: [{ playerId: "p1", runs: 50, balls: 40, fours: 5, sixes: 1, isOut: true }],
        bowling: [{ playerId: "p1", legalBalls: 24, runsConceded: 120, wickets: 2, maidens: 0 }],
        fielding: { catches: 1, runOuts: 0, stumpings: 0 },
      },
      {
        batting: [{ playerId: "p1", runs: 30, balls: 20, fours: 2, sixes: 0, isOut: false }],
        bowling: [],
        fielding: { catches: 0, runOuts: 1, stumpings: 0 },
      },
    ])
    expect(stats.batting.matches).toBe(2)
    expect(stats.batting.runs).toBe(80)
    expect(stats.batting.average).toBe(80) // 80 runs / 1 dismissal
    expect(stats.batting.highestScore).toBe("50")
    expect(stats.bowling.wickets).toBe(2)
    expect(stats.fielding.catches).toBe(1)
    expect(stats.fielding.runOuts).toBe(1)
  })
})
