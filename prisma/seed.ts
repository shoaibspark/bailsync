import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const ROLE_SUPERADMIN = "SUPERADMIN"
const ROLE_ADMIN = "ADMIN"
const ROLE_SCORER = "SCORER"
const ROLE_VIEWER = "VIEWER"

async function main() {
  // ---- Users (idempotent by email) ----
  const passwordHash = await bcrypt.hash("bailsync123", 10)

  const superadmin = await prisma.user.upsert({
    where: { email: "admin@gmail.com" },
    update: { role: ROLE_SUPERADMIN, passwordHash },
    create: {
      name: "Bailsync Super Admin",
      email: "admin@gmail.com",
      passwordHash,
      role: ROLE_SUPERADMIN,
    },
  })

  const admin = await prisma.user.upsert({
    where: { email: "admin@bailsync.local" },
    update: { role: ROLE_ADMIN, passwordHash },
    create: {
      name: "Bailsync Admin",
      email: "admin@bailsync.local",
      passwordHash,
      role: ROLE_ADMIN,
    },
  })

  const scorer1 = await prisma.user.upsert({
    where: { email: "scorer1@bailsync.local" },
    update: { role: ROLE_SCORER, passwordHash },
    create: {
      name: "Scorer One",
      email: "scorer1@bailsync.local",
      passwordHash,
      role: ROLE_SCORER,
    },
  })

  const scorer2 = await prisma.user.upsert({
    where: { email: "scorer2@bailsync.local" },
    update: { role: ROLE_SCORER, passwordHash },
    create: {
      name: "Scorer Two",
      email: "scorer2@bailsync.local",
      passwordHash,
      role: ROLE_SCORER,
    },
  })

  console.log("Seeded users:", {
    superadmin: superadmin.email,
    admin: admin.email,
    scorer1: scorer1.email,
    scorer2: scorer2.email,
  })

  // ---- Clubs ----
  const eagles = await prisma.club.upsert({
    where: { name: "Eagles CC" },
    update: {},
    create: { name: "Eagles CC", shortName: "EAG", city: "London" },
  })

  const hawks = await prisma.club.upsert({
    where: { name: "Hawks CC" },
    update: {},
    create: { name: "Hawks CC", shortName: "HAK", city: "Manchester" },
  })

  console.log("Seeded clubs:", { eagles: eagles.id, hawks: hawks.id })

  await prisma.user.update({ where: { id: admin.id }, data: { clubId: eagles.id } })
  await prisma.user.update({ where: { id: scorer1.id }, data: { clubId: eagles.id } })
  await prisma.user.update({ where: { id: scorer2.id }, data: { clubId: hawks.id } })

  // ---- Players (11 per club) ----
const player = (
  clubId: string,
  name: string,
  jersey?: number,
  role = "BATTER" as "BATTER" | "BOWLER" | "ALL_ROUNDER" | "WICKET_KEEPER",
  battingStyle?: string | null,
  bowlingStyle?: string | null,
) =>
  prisma.player.upsert({
    where: { name_clubId: { name, clubId } },
    update: { jerseyNumber: jersey, role, battingStyle, bowlingStyle },
    create: { clubId, name, jerseyNumber: jersey, role, battingStyle, bowlingStyle },
  })

  const eaglesPlayers = [
    player(eagles.id, "A. Rahman", 3, "BATTER", "Right-hand bat", "Right-arm offbreak"),
    player(eagles.id, "B. Patel", 7, "BATTER", "Left-hand bat", null),
    player(eagles.id, "C. Singh", 11, "ALL_ROUNDER", "Right-hand bat", "Right-arm fast-medium"),
    player(eagles.id, "D. Khan", 18, "BATTER", "Right-hand bat", null),
    player(eagles.id, "E. Malik", 22, "BATTER", "Left-hand bat", "Slow left-arm orthodox"),
    player(eagles.id, "F. Ali", 5, "WICKET_KEEPER", "Right-hand bat", null),
    player(eagles.id, "G. Shah", 9, "BOWLER", "Right-hand bat", "Right-arm fast"),
    player(eagles.id, "H. Iqbal", 14, "BOWLER", "Right-hand bat", "Right-arm legbreak"),
    player(eagles.id, "I. Hussain", 4, "BATTER", "Right-hand bat", null),
    player(eagles.id, "J. Butt", 2, "BATTER", "Right-hand bat", null),
    player(eagles.id, "K. Zaman", 1, "BOWLER", "Right-hand bat", "Right-arm fast-medium"),
  ]

  const hawksPlayers = [
    player(hawks.id, "L. Smith", 3, "BATTER", "Right-hand bat", "Right-arm offbreak"),
    player(hawks.id, "M. Jones", 7, "BATTER", "Left-hand bat", null),
    player(hawks.id, "N. Brown", 11, "ALL_ROUNDER", "Right-hand bat", "Right-arm fast-medium"),
    player(hawks.id, "O. Davis", 18, "BATTER", "Right-hand bat", null),
    player(hawks.id, "P. Wilson", 22, "BATTER", "Left-hand bat", "Slow left-arm orthodox"),
    player(hawks.id, "Q. Taylor", 5, "WICKET_KEEPER", "Right-hand bat", null),
    player(hawks.id, "R. Thomas", 9, "BOWLER", "Right-hand bat", "Right-arm fast"),
    player(hawks.id, "S. Johnson", 14, "BOWLER", "Right-hand bat", "Right-arm legbreak"),
    player(hawks.id, "T. Williams", 4, "BATTER", "Right-hand bat", null),
    player(hawks.id, "U. Brown", 2, "BATTER", "Right-hand bat", null),
    player(hawks.id, "V. Clark", 1, "BOWLER", "Right-hand bat", "Right-arm fast-medium"),
  ]

  await Promise.all([...eaglesPlayers, ...hawksPlayers])
  console.log("Seeded players:", { eagles: eaglesPlayers.length, hawks: hawksPlayers.length })

  // Re-fetch players with ids
  const ePlayers = await prisma.player.findMany({ where: { clubId: eagles.id }, orderBy: { name: "asc" } })
  const hPlayers = await prisma.player.findMany({ where: { clubId: hawks.id }, orderBy: { name: "asc" } })

  // ---- Tournament ----
  const tournament = await prisma.tournament.upsert({
    where: { name: "City T20 League" },
    update: { managerId: superadmin.id },
    create: {
      name: "City T20 League",
      format: "LEAGUE",
      oversPerInnings: 20,
      maxOversPerBowler: 4,
      ballsPerOver: 6,
      wideRuns: 1,
      noBallRuns: 1,
      lastManStands: false,
      pointsWin: 2,
      pointsTie: 1,
      pointsNoResult: 1,
      managerId: superadmin.id,
    },
  })
  console.log("Seeded tournament:", tournament.id)

  // ---- Match 1: Eagles vs Hawks (live, innings 1 in progress) ----
  let match1 = await prisma.match.findFirst({
    where: { tournamentId: tournament.id, homeClubId: eagles.id, awayClubId: hawks.id, status: "LIVE" },
  })
  if (!match1) {
    match1 = await prisma.match.create({
      data: {
        tournamentId: tournament.id,
        homeClubId: eagles.id,
        awayClubId: hawks.id,
        venue: "Lord's Indoor Ground",
        scheduledAt: new Date(),
        status: "LIVE",
        oversPerInnings: 20,
        maxOversPerBowler: 4,
        activeScorerId: scorer1.id,
      },
    })
  }

  // Squads
  const squadData = [
    { clubId: eagles.id, players: ePlayers },
    { clubId: hawks.id, players: hPlayers },
  ]
  for (const { clubId, players } of squadData) {
    await prisma.matchSquad.createMany({
      data: players.map((p: { id: string }, i: number) => ({
        matchId: match1.id,
        clubId,
        playerId: p.id,
        isPlayingXI: i < 11,
        isCaptain: i === 0,
        isWicketKeeper: i === 5,
      })),
    })
  }

  // Toss: Eagles won, elected to bat
  await prisma.match.update({
    where: { id: match1.id },
    data: { tossWinnerClubId: eagles.id, tossDecision: "BAT" },
  })

  // Innings 1: Eagles batting, Hawks bowling
  const innings1 = await prisma.innings.create({
    data: {
      matchId: match1.id,
      inningsNumber: 1,
      battingClubId: eagles.id,
      bowlingClubId: hawks.id,
    },
  })

  // Realistic ball events: over 1
  const eOpeners = ePlayers.slice(0, 2)
  const hBowlers = hPlayers.filter((p: { role: string }) => p.role === "BOWLER" || p.role === "ALL_ROUNDER")
  const striker = eOpeners[0]
  const nonStriker = eOpeners[1]
  const bowler = hBowlers[0]

  const events: Array<{
    sequenceNumber: number
    overNumber: number
    ballInOver: number
    strikerId: string
    nonStrikerId: string
    bowlerId: string
    runsScored: number
    extraType: "NONE" | "WIDE" | "NO_BALL" | "BYE" | "LEG_BYE" | "PENALTY"
    extraRuns: number
    isWicket: boolean
    wicketType?: "BOWLED" | "CAUGHT" | "LBW" | "RUN_OUT" | "STUMPED" | "HIT_WICKET"
    dismissedPlayerId?: string
    fielderId?: string
    wagonWheelZone?: number
    commentaryText?: string
  }> = [
    // Over 1
    { sequenceNumber: 1, overNumber: 1, ballInOver: 1, strikerId: striker.id, nonStrikerId: nonStriker.id, bowlerId: bowler.id, runsScored: 1, extraType: "NONE", extraRuns: 0, isWicket: false, commentaryText: "Single to mid-on" },
    { sequenceNumber: 2, overNumber: 1, ballInOver: 2, strikerId: nonStriker.id, nonStrikerId: striker.id, bowlerId: bowler.id, runsScored: 4, extraType: "NONE", extraRuns: 0, isWicket: false, wagonWheelZone: 4, commentaryText: "Boundary through cover" },
    { sequenceNumber: 3, overNumber: 1, ballInOver: 3, strikerId: striker.id, nonStrikerId: nonStriker.id, bowlerId: bowler.id, runsScored: 0, extraType: "NONE", extraRuns: 0, isWicket: false, commentaryText: "Dot ball" },
    { sequenceNumber: 4, overNumber: 1, ballInOver: 4, strikerId: nonStriker.id, nonStrikerId: striker.id, bowlerId: bowler.id, runsScored: 6, extraType: "NONE", extraRuns: 0, isWicket: false, wagonWheelZone: 7, commentaryText: "Smashed over long-on" },
    { sequenceNumber: 5, overNumber: 1, ballInOver: 5, strikerId: striker.id, nonStrikerId: nonStriker.id, bowlerId: bowler.id, runsScored: 0, extraType: "WIDE", extraRuns: 2, isWicket: false, commentaryText: "Wide down leg, two runs" },
    { sequenceNumber: 6, overNumber: 1, ballInOver: 6, strikerId: nonStriker.id, nonStrikerId: striker.id, bowlerId: bowler.id, runsScored: 0, extraType: "NONE", extraRuns: 0, isWicket: true, wicketType: "BOWLED", dismissedPlayerId: striker.id, commentaryText: "Bowled him! Striker out" },
  ]

  for (const e of events) {
    await prisma.ballEvent.create({
      data: {
        inningsId: innings1.id,
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
        wagonWheelZone: e.wagonWheelZone,
        commentaryText: e.commentaryText,
      },
    })
  }

  console.log("Seeded match 1 (live):", { matchId: match1.id, innings1Id: innings1.id, balls: events.length })

  // ---- Match 2: completed historical match (Eagles won by 14 runs), all-out innings for NRR demo ----
  const match2 = await prisma.match.create({
    data: {
      tournamentId: tournament.id,
      homeClubId: hawks.id,
      awayClubId: eagles.id,
      venue: "Oval Annexe",
      scheduledAt: new Date(Date.now() - 86400000 * 3),
      status: "COMPLETED",
      oversPerInnings: 20,
      maxOversPerBowler: 4,
      resultType: "WIN_WICKETS",
      winnerClubId: eagles.id,
      resultSummary: "Eagles won by 2 wickets",
    },
  })

  for (const { clubId, players } of squadData) {
    await prisma.matchSquad.createMany({
      data: players.map((p: { id: string }, i: number) => ({
        matchId: match2.id,
        clubId,
        playerId: p.id,
        isPlayingXI: i < 11,
        isCaptain: i === 0,
        isWicketKeeper: i === 5,
      })),
    })
  }

  // Innings 1: Hawks batting, all out for 152 in 18.4 (NRR all-out rule: count full 20 overs faced)
  const innings21 = await prisma.innings.create({
    data: { matchId: match2.id, inningsNumber: 1, battingClubId: hawks.id, bowlingClubId: eagles.id, targetRuns: null, isCompleted: true },
  })
  // Innings 2: Eagles batting, chase falls short at 138/8
  const innings22 = await prisma.innings.create({
    data: { matchId: match2.id, inningsNumber: 2, battingClubId: eagles.id, bowlingClubId: hawks.id, targetRuns: 153, isCompleted: true },
  })

  // Generate a compact set of events for innings 21 (11 wickets, 111 balls -> all out at 18.3 overs)
  // We'll create a realistic but compact sequence: 10 scoring balls then a wicket repeated
  const seq = 0
  const overBalls = 6
  const innings21Events: Array<{
    sequenceNumber: number
    overNumber: number
    ballInOver: number
    strikerId: string
    nonStrikerId: string
    bowlerId: string
    runsScored: number
    extraType: "NONE" | "WIDE" | "NO_BALL" | "BYE" | "LEG_BYE" | "PENALTY"
    extraRuns: number
    isWicket: boolean
    wicketType?: "BOWLED" | "CAUGHT" | "LBW" | "RUN_OUT" | "STUMPED" | "HIT_WICKET"
    dismissedPlayerId?: string
    commentaryText: string
  }> = []
  let striker21 = hPlayers[0]
  let nonStriker21 = hPlayers[1]
  let bowler21 = ePlayers[6] // first bowler
  let overNum = 1
  let ballInOver = 0
  let hawksWickets = 0
  let hawksRuns = 0

  // Build ~111 balls: score runs, take wickets regularly, end all out at 152 in 18.4
  // Simplified: create events programmatically
  const totalBalls21 = 111
  for (let i = 0; i < totalBalls21 && hawksWickets < 10; i++) {
    ballInOver++
    if (ballInOver > overBalls) {
      overNum++
      ballInOver = 1
      ;[striker21, nonStriker21] = [nonStriker21, striker21]
      // rotate bowler after each over (skip if no bowler)
      bowler21 = ePlayers[(overNum - 1) % 5 + 6]
    }
    const isWicket = i % 10 === 9 && hawksWickets < 10 // wicket every 10th ball
    const runs = isWicket ? 0 : [0, 1, 2, 4, 1, 0][i % 6]
    hawksRuns += runs
    innings21Events.push({
      sequenceNumber: i + 1,
      overNumber: overNum,
      ballInOver,
      strikerId: striker21.id,
      nonStrikerId: nonStriker21.id,
      bowlerId: bowler21.id,
      runsScored: runs,
      extraType: "NONE",
      extraRuns: 0,
      isWicket: isWicket,
      wicketType: isWicket ? "BOWLED" : undefined,
      dismissedPlayerId: isWicket ? striker21.id : undefined,
      commentaryText: isWicket ? "Wicket!" : runs > 0 ? `${runs} runs` : "Dot",
    })
    hawksWickets += isWicket ? 1 : 0
    if (!isWicket && runs % 2 === 1) {
      ;[striker21, nonStriker21] = [nonStriker21, striker21]
    }
  }
  console.log("Innings 21 (all out): runs", hawksRuns, "balls", innings21Events.length)

  for (const e of innings21Events) {
    await prisma.ballEvent.create({
      data: {
        inningsId: innings21.id,
        ...e,
      },
    })
  }

  // Innings 22: Eagles chase, 138/8 in 20 overs (target 153, falls short by 14)
  const innings22Events: Array<{
    sequenceNumber: number
    overNumber: number
    ballInOver: number
    strikerId: string
    nonStrikerId: string
    bowlerId: string
    runsScored: number
    extraType: "NONE" | "WIDE" | "NO_BALL" | "BYE" | "LEG_BYE" | "PENALTY"
    extraRuns: number
    isWicket: boolean
    wicketType?: "BOWLED" | "CAUGHT" | "LBW" | "RUN_OUT" | "STUMPED" | "HIT_WICKET"
    dismissedPlayerId?: string
    commentaryText: string
  }> = []
  let striker22 = ePlayers[0]
  let nonStriker22 = ePlayers[1]
  let bowler22 = hPlayers[6]
  let overNum22 = 1
  let ballInOver22 = 0
  let eaglesWickets22 = 0
  let eaglesRuns22 = 0
  const totalBalls22 = 120
  for (let i = 0; i < totalBalls22 && eaglesWickets22 < 8; i++) {
    ballInOver22++
    if (ballInOver22 > overBalls) {
      overNum22++
      ballInOver22 = 1
      ;[striker22, nonStriker22] = [nonStriker22, striker22]
      bowler22 = hPlayers[(overNum22 - 1) % 5 + 6]
    }
    const isWicket = i % 15 === 14 && eaglesWickets22 < 8
    const runs = isWicket ? 0 : [1, 2, 1, 4, 1, 0][i % 6]
    eaglesRuns22 += runs
    innings22Events.push({
      sequenceNumber: i + 1,
      overNumber: overNum22,
      ballInOver: ballInOver22,
      strikerId: striker22.id,
      nonStrikerId: nonStriker22.id,
      bowlerId: bowler22.id,
      runsScored: runs,
      extraType: "NONE",
      extraRuns: 0,
      isWicket: isWicket,
      wicketType: isWicket ? "CAUGHT" : undefined,
      dismissedPlayerId: isWicket ? striker22.id : undefined,
      commentaryText: isWicket ? "Caught!" : runs > 0 ? `${runs} runs` : "Dot",
    })
    eaglesWickets22 += isWicket ? 1 : 0
    if (!isWicket && runs % 2 === 1) {
      ;[striker22, nonStriker22] = [nonStriker22, striker22]
    }
  }
  console.log("Innings 22 (chase short): runs", eaglesRuns22, "balls", innings22Events.length)

  for (const e of innings22Events) {
    await prisma.ballEvent.create({
      data: {
        inningsId: innings22.id,
        ...e,
      },
    })
  }

  console.log("Seeded match 2 (completed):", match2.id)

  // ---- Match 3: completed tie / NRR demo ----
  const match3 = await prisma.match.create({
    data: {
      tournamentId: tournament.id,
      homeClubId: eagles.id,
      awayClubId: hawks.id,
      venue: "City Ground",
      scheduledAt: new Date(Date.now() - 86400000 * 7),
      status: "COMPLETED",
      oversPerInnings: 20,
      maxOversPerBowler: 4,
      resultType: "TIE",
      resultSummary: "Match tied",
    },
  })
  console.log("Seeded match 3 (tie):", match3.id)

  console.log("Seed complete.")
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
