import { db } from "@/lib/db"
import { computeMatchState, type InningsInput } from "@/lib/cricket-engine/reducer"
import type { MatchState } from "@/lib/cricket-engine/types"

export async function getMatchStateSnapshot(matchId: string): Promise<MatchState | null> {
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      homeClub: true,
      awayClub: true,
      innings: {
        orderBy: { inningsNumber: "asc" },
        include: {
          battingClub: true,
          bowlingClub: true,
          ballEvents: {
            where: { deletedAt: null },
            orderBy: { sequenceNumber: "asc" },
          },
        },
      },
    },
  })

  if (!match) return null

  const squads = await db.matchSquad.findMany({
    where: { matchId },
    include: { player: true },
  })

  const playerNames = Object.fromEntries(
    squads.map((squad) => [squad.playerId, squad.player.name]),
  )
  const playingXIByClub = new Map<string, string[]>()

  for (const clubId of [match.homeClubId, match.awayClubId]) {
    playingXIByClub.set(
      clubId,
      squads
        .filter((squad) => squad.clubId === clubId && squad.isPlayingXI)
        .sort((a, b) => a.player.name.localeCompare(b.player.name))
        .map((squad) => squad.playerId),
    )
  }

  const matchConfig = {
    oversPerInnings: match.oversPerInnings,
    maxOversPerBowler: match.maxOversPerBowler,
    ballsPerOver: 6,
    wideRuns: 1,
    noBallRuns: 1,
    lastManStands: false,
  }

  const inningsList: InningsInput[] = match.innings.map((innings) => ({
    inningsNumber: innings.inningsNumber,
    inningsId: innings.id,
    matchId: match.id,
    battingClubId: innings.battingClubId,
    battingClubName: innings.battingClub.name,
    bowlingClubId: innings.bowlingClubId,
    bowlingClubName: innings.bowlingClub.name,
    targetRuns: innings.targetRuns ?? undefined,
    playingXI: playingXIByClub.get(innings.battingClubId) ?? [],
    bowlingXI: playingXIByClub.get(innings.bowlingClubId) ?? [],
    isSuperOver: innings.inningsNumber > 2,
    events: innings.ballEvents.map((event) => ({
      id: event.id,
      inningsId: event.inningsId,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      sequenceNumber: event.sequenceNumber,
      overNumber: event.overNumber,
      ballInOver: event.ballInOver,
      strikerId: event.strikerId,
      nonStrikerId: event.nonStrikerId,
      bowlerId: event.bowlerId,
      runsScored: event.runsScored,
      extraType: event.extraType,
      extraRuns: event.extraRuns,
      isWicket: event.isWicket,
      wicketType: event.wicketType ?? undefined,
      dismissedPlayerId: event.dismissedPlayerId ?? undefined,
      fielderId: event.fielderId ?? undefined,
      incomingBatterId: event.incomingBatterId ?? undefined,
      deletedAt: event.deletedAt,
      wagonWheelZone: event.wagonWheelZone ?? undefined,
      commentaryText: event.commentaryText ?? undefined,
    })),
  }))

  const state = computeMatchState(
    match.id,
    inningsList,
    matchConfig,
    {
      homeClub: {
        id: match.homeClub.id,
        name: match.homeClub.name,
        shortName: match.homeClub.shortName,
      },
      awayClub: {
        id: match.awayClub.id,
        name: match.awayClub.name,
        shortName: match.awayClub.shortName,
      },
      playerNames,
    },
  )

  for (const innings of [
    state.innings1,
    state.innings2,
    state.superOver1,
    state.superOver2,
  ]) {
    if (!innings) continue
    innings.batters = innings.batters.map((batter) => ({
      ...batter,
      name: playerNames[batter.playerId] ?? "Unknown player",
    }))
    innings.bowlers = innings.bowlers.map((bowler) => ({
      ...bowler,
      name: playerNames[bowler.playerId] ?? "Unknown player",
    }))
  }

  return state
}
