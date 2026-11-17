// lib/stats/player.ts
// Pure career aggregation over BallEvent records.


export interface BattingCareer {
  matches: number
  innings: number
  runs: number
  balls: number
  average: number | null
  strikeRate: number
  fifties: number
  hundreds: number
  highestScore: string // e.g. "85*" or "102"
  fours: number
  sixes: number
}

export interface BowlingCareer {
  matches: number
  overs: string // x.y
  ballsBowled: number
  wickets: number
  runsConceded: number
  average: number | null
  economy: number
  strikeRate: number | null
  bestBowling: string // e.g. "3/24"
  maidens: number
}

export interface FieldingCareer {
  catches: number
  runOuts: number
  stumpings: number
}

export interface PlayerCareerStats {
  playerId: string
  name: string
  batting: BattingCareer
  bowling: BowlingCareer
  fielding: FieldingCareer
}

interface InningsBatting {
  playerId: string
  runs: number
  balls: number
  fours: number
  sixes: number
  isOut: boolean
}

interface InningsBowling {
  playerId: string
  legalBalls: number
  runsConceded: number
  wickets: number
  maidens: number
}

export function aggregatePlayerStats(
  playerId: string,
  playerName: string,
  innings: Array<{
    matchId?: string
    batting: InningsBatting[]
    bowling: InningsBowling[]
    fielding: { catches: number; runOuts: number; stumpings: number }
  }>,
): PlayerCareerStats {
  const battingMatches = new Set<string>()
  const bowlingMatches = new Set<string>()
  let inningsCount = 0
  let runs = 0
  let balls = 0
  let fours = 0
  let sixes = 0
  let dismissals = 0
  let fifties = 0
  let hundreds = 0
  let bestRuns = -1
  let bestIsOut = false

  let bowlLegalBalls = 0
  let bowlRuns = 0
  let bowlWickets = 0
  let bowlMaidens = 0
  let bestWickets = -1
  let bestRunsConceded = 0

  let catches = 0
  let runOuts = 0
  let stumpings = 0

  for (const [index, inn] of innings.entries()) {
    const bat = inn.batting.find((b) => b.playerId === playerId)
    const bowl = inn.bowling.find((b) => b.playerId === playerId)

    const batted = !!bat
    const bowled = !!bowl

    const matchKey = inn.matchId ?? `innings-${index}`
    if (batted) battingMatches.add(matchKey)
    if (bowled) bowlingMatches.add(matchKey)
    if (batted) inningsCount += 1

    if (batted) {
      runs += bat.runs
      balls += bat.balls
      fours += bat.fours
      sixes += bat.sixes
      if (bat.isOut) {
        dismissals += 1
        if (bat.runs > bestRuns || (bat.runs === bestRuns && !bestIsOut)) {
          bestRuns = bat.runs
          bestIsOut = true
        }
      } else {
        if (bat.runs > bestRuns || (bat.runs === bestRuns && bestIsOut)) {
          bestRuns = bat.runs
          bestIsOut = false
        }
      }
      if (bat.runs >= 100) hundreds += 1
      else if (bat.runs >= 50) fifties += 1
    }

    if (bowled) {
      bowlLegalBalls += bowl.legalBalls
      bowlRuns += bowl.runsConceded
      bowlWickets += bowl.wickets
      bowlMaidens += bowl.maidens
      if (
        bowl.wickets > bestWickets ||
        (bowl.wickets === bestWickets && bowl.runsConceded < bestRunsConceded)
      ) {
        bestWickets = bowl.wickets
        bestRunsConceded = bowl.runsConceded
      }
    }

    catches += inn.fielding.catches
    runOuts += inn.fielding.runOuts
    stumpings += inn.fielding.stumpings
  }

  const average = dismissals ? Math.round((runs / dismissals) * 100) / 100 : null
  const strikeRate = balls ? Math.round((runs / balls) * 100) : 0
  const highestScore = bestRuns < 0 ? "0" : `${bestRuns}${bestIsOut ? "" : "*"}`

  const bowlAverage = bowlWickets ? Math.round((bowlRuns / bowlWickets) * 100) / 100 : null
  const bowlEconomy = bowlLegalBalls ? Math.round((bowlRuns / (bowlLegalBalls / 6)) * 100) / 100 : 0
  const bowlStrikeRate = bowlWickets ? Math.round((bowlLegalBalls / bowlWickets) * 100) / 100 : null

  const overStr = `${Math.floor(bowlLegalBalls / 6)}.${bowlLegalBalls % 6}`
  const bestBowling = bestWickets < 0 ? "0/0" : `${bestWickets}/${bestRunsConceded}`

  return {
    playerId,
    name: playerName,
    batting: {
      matches: new Set([...battingMatches, ...bowlingMatches]).size,
      innings: inningsCount,
      runs,
      balls,
      average,
      strikeRate,
      fifties,
      hundreds,
      highestScore,
      fours,
      sixes,
    },
    bowling: {
      matches: bowlingMatches.size,
      overs: overStr,
      ballsBowled: bowlLegalBalls,
      wickets: bowlWickets,
      runsConceded: bowlRuns,
      average: bowlAverage,
      economy: bowlEconomy,
      strikeRate: bowlStrikeRate,
      bestBowling,
      maidens: bowlMaidens,
    },
    fielding: { catches, runOuts, stumpings },
  }
}
