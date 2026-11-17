// lib/cricket-engine/formatters.ts
// Display formatters for cricket scores.

export function formatOvers(balls: number, ballsPerOver: number = 6): string {
  const o = Math.floor(balls / ballsPerOver)
  const b = balls % ballsPerOver
  return `${o}.${b}`
}

export function formatScore(runs: number, wickets: number): string {
  return `${runs}/${wickets}`
}

export function formatStrikeRate(runs: number, balls: number): string {
  return balls ? ((runs / balls) * 100).toFixed(0) : "0"
}

export function formatEconomy(runs: number, balls: number): string {
  return balls ? (runs / (balls / 6)).toFixed(2) : "0.00"
}

export function formatAverage(runs: number, dismissals: number): string {
  if (!dismissals) return "-"
  return (runs / dismissals).toFixed(2)
}

export function formatRRR(
  runsRemaining: number,
  ballsLeft: number,
): string {
  if (ballsLeft <= 0) return "-"
  return ((runsRemaining / (ballsLeft / 6)) * 100).toFixed(0) + "/6"
}

export function formatCrr(runs: number, overs: number): string {
  return overs > 0 ? (runs / overs).toFixed(2) : "0.00"
}

export function wicketTypeLabel(type: string | null): string {
  const labels: Record<string, string> = {
    BOWLED: "Bowled",
    CAUGHT: "Caught",
    LBW: "LBW",
    RUN_OUT: "Run out",
    STUMPED: "Stumped",
    HIT_WICKET: "Hit wicket",
    RETIRED_HURT: "Retired hurt",
    RETIRED_OUT: "Retired out",
    OBSTRUCTING_FIELD: "Obstructing",
    TIMED_OUT: "Timed out",
  }
  return type ? labels[type] ?? type : "—"
}

export function extraTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    NONE: "—",
    WIDE: "Wide",
    NO_BALL: "No ball",
    BYE: "Bye",
    LEG_BYE: "Leg bye",
    PENALTY: "Penalty",
  }
  return labels[type] ?? type
}
