// lib/tournament/standings.ts
// Pure points table + Net Run Rate engine.
// NRR = (total runs scored ÷ total overs faced) − (total runs conceded ÷ total overs bowled)
// Overs converted from balls (14.3 balls = 14.5 overs).
// All-out rule: a team bowled out before its quota counts the FULL quota as overs faced.

export interface TeamStanding {
  clubId: string
  clubName: string
  played: number
  won: number
  lost: number
  tied: number
  noResult: number
  points: number
  nrr: number
  runsScored: number
  oversFaced: number // in overs (decimal)
  runsConceded: number
  oversBowled: number // in overs (decimal)
}

interface InningsSummary {
  battingClubId: string
  bowlingClubId: string
  runs: number
  wickets: number
  legalBalls: number
  oversBowledByBowling: number // decimal overs
  isAllOut: boolean
  targetChased: boolean
  targetRuns?: number
  completed: boolean
}

function ballsToOvers(balls: number): number {
  return balls / 6
}

export interface StandingsInput {
  matches: Array<{
    id: string
    status: string
    resultType: string | null
    resultSummary: string | null
    winnerClubId: string | null
    oversPerInnings: number
    innings: InningsSummary[]
  }>
  clubs: Array<{ id: string; name: string }>
  pointsWin?: number
  pointsTie?: number
  pointsNoResult?: number
}

export function computeStandings(input: StandingsInput): TeamStanding[] {
  const {
    matches,
    clubs,
    pointsWin = 2,
    pointsTie = 1,
    pointsNoResult = 1,
  } = input

  const clubMap = new Map(clubs.map((c) => [c.id, c.name]))

  const stats = new Map<
    string,
    {
      played: number
      won: number
      lost: number
      tied: number
      noResult: number
      points: number
      runsScored: number
      oversFacedBalls: number
      runsConceded: number
      oversBowledBalls: number
    }
  >()

  for (const c of clubs) {
    stats.set(c.id, {
      played: 0, won: 0, lost: 0, tied: 0, noResult: 0, points: 0,
      runsScored: 0, oversFacedBalls: 0, runsConceded: 0, oversBowledBalls: 0,
    })
  }

  for (const match of matches) {
    const { oversPerInnings } = match
    const quotaBalls = oversPerInnings * 6

    // exclude non-completed matches from NRR/points (except awarding points for no-result)
    const completed = match.status === "COMPLETED"
    const isNoResult = match.resultType === "NO_RESULT"

    for (const inn of match.innings) {
      const st = stats.get(inn.battingClubId)
      const bowl = stats.get(inn.bowlingClubId)
      if (!st || !bowl) continue

      st.played += 1
      bowl.played += 1

      // runs scored / overs faced (batting side)
      st.runsScored += inn.runs
      const oversFacedBalls = inn.isAllOut
        ? quotaBalls // all-out rule: full quota
        : inn.legalBalls
      st.oversFacedBalls += oversFacedBalls

      // runs conceded / overs bowled (bowling side)
      bowl.runsConceded += inn.runs
      bowl.oversBowledBalls += inn.oversBowledByBowling * 6
    }

    // points / result
    if (isNoResult) {
      for (const inn of match.innings) {
        const st = stats.get(inn.battingClubId)
        const bowl = stats.get(inn.bowlingClubId)
        if (st) st.noResult += 1
        if (bowl) bowl.noResult += 1
      }
      for (const inn of match.innings) {
        const st = stats.get(inn.battingClubId)
        if (st) st.points += pointsNoResult
      }
      continue
    }

    if (!completed) continue

    const i1 = match.innings[0]
    const i2 = match.innings[1]

    if (!i1 || !i2) continue

    if (match.resultType === "TIE") {
      const s1 = stats.get(i1.battingClubId)
      const s2 = stats.get(i2.battingClubId)
      if (s1) { s1.tied += 1; s1.points += pointsTie }
      if (s2) { s2.tied += 1; s2.points += pointsTie }
    } else if (match.winnerClubId) {
      const winner = stats.get(match.winnerClubId)
      if (winner) { winner.won += 1; winner.points += pointsWin }
      // loser
      for (const inn of match.innings) {
        const loser = inn.battingClubId === match.winnerClubId
          ? stats.get(inn.bowlingClubId)
          : stats.get(inn.battingClubId)
        if (loser) loser.lost += 1
      }
    }
  }

  const result: TeamStanding[] = []
  for (const [clubId, s] of stats) {
    const oversFaced = ballsToOvers(s.oversFacedBalls)
    const oversBowled = ballsToOvers(s.oversBowledBalls)
    const nrr =
      oversFaced > 0 && oversBowled > 0
        ? (s.runsScored / oversFaced) - (s.runsConceded / oversBowled)
        : 0
    result.push({
      clubId,
      clubName: clubMap.get(clubId) ?? clubId,
      played: s.played,
      won: s.won,
      lost: s.lost,
      tied: s.tied,
      noResult: s.noResult,
      points: s.points,
      nrr: Math.round(nrr * 1000) / 1000,
      runsScored: s.runsScored,
      oversFaced,
      runsConceded: s.runsConceded,
      oversBowled,
    })
  }

  // sort: points desc, nrr desc, wins desc
  result.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.nrr !== a.nrr) return b.nrr - a.nrr
    return b.won - a.won
  })

  return result
}
