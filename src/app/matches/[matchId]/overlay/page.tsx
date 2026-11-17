"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { Award, ChevronRight, Circle } from "lucide-react"
import { useMatchStream } from "@/hooks/use-match-stream"
import { formatStrikeRate } from "@/lib/cricket-engine/formatters"
import { AnimatedNumber } from "@/components/animated-number"

export default function OverlayPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const [preview, setPreview] = useState(false)
  const { state, connected } = useMatchStream(matchId)
  const [banner, setBanner] = useState<{ kind: "4" | "6" | "W"; text: string } | null>(null)
  const lastSequence = useRef(0)
  const innings = state?.currentInningsNumber === 2 ? state.innings2 : state?.innings1
  const striker = innings?.batters.find((batter) => batter.isOnStrike)
  const nonStriker = innings?.batters.find((batter) => batter.playerId === innings.nonStrikerId)
  const bowler = innings?.bowlers.find((item) => item.isCurrent)
  const lastBall = innings?.oversTimeline.at(-1)?.balls.at(-1)

  const battingTeam = innings?.battingClubName ?? state?.homeClub?.name ?? "Home"
  const target = innings?.targetRuns

  useEffect(() => {
    setPreview(new URLSearchParams(window.location.search).get("preview") === "1")
  }, [])

  useEffect(() => {
    if (!lastBall || lastBall.sequenceNumber <= lastSequence.current) return
    lastSequence.current = lastBall.sequenceNumber
    if (lastBall.isWicket) setBanner({ kind: "W", text: "Wicket" })
    else if (lastBall.runsScored === 4) setBanner({ kind: "4", text: "Four" })
    else if (lastBall.runsScored === 6) setBanner({ kind: "6", text: "Six" })
    else return
    const timer = window.setTimeout(() => setBanner(null), 2500)
    return () => window.clearTimeout(timer)
  }, [lastBall])

  const shellClass = useMemo(
    () =>
      preview
        ? "bg-[radial-gradient(circle_at_20%_20%,#0f172a,#020617_60%)]"
        : "bg-transparent",
    [preview],
  )

  return (
    <div className={`fixed inset-0 h-full w-full select-none font-sans text-white ${shellClass}`} style={{ fontFamily: "'Arial Black', 'Helvetica Neue', Arial, sans-serif" }}>
      {preview && (
        <div className="fixed left-4 top-4 rounded bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/70">
          Preview mode — remove ?preview=1 for OBS
        </div>
      )}

      <div className="fixed bottom-[8%] left-[4%] right-[4%] flex items-end gap-6 px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="min-w-0 flex-1 border-b-2 border-white/40 pb-2">
          <div className="mb-1 flex items-center gap-3">
            <div className="size-2 rounded-full bg-green-400 animate-pulse" />
            <span className="truncate text-xs font-bold uppercase tracking-wider sm:text-sm">
              {battingTeam} · Innings {innings?.inningsNumber ?? 1}
            </span>
            {target !== undefined && target !== null && (
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300">Target {target}</span>
            )}
          </div>
          <div className="flex items-baseline gap-3 sm:gap-4">
            <AnimatedNumber value={innings?.totalRuns ?? 0} className="text-4xl font-black sm:text-5xl" />
            <AnimatedNumber value={innings?.wickets ?? 0} className="text-3xl font-black text-slate-400 sm:text-3xl" />
            <span className="font-mono text-lg text-slate-300 sm:text-xl">{innings?.overs ?? "0.0"} overs</span>
          </div>
        </div>
        <div className="hidden w-48 flex-col gap-1 lg:flex">
          <div className="text-xs uppercase tracking-wider text-slate-400">Striker</div>
          <div className="truncate text-2xl font-black">{striker?.name ?? "—"}</div>
          <div className="text-sm text-slate-300">{striker?.runs} off {striker?.balls} · SR {formatStrikeRate(striker?.runs ?? 0, striker?.balls ?? 0)}</div>
        </div>
        <div className="hidden w-48 flex-col gap-1 lg:flex">
          <div className="text-xs uppercase tracking-wider text-slate-400">Non-striker</div>
          <div className="truncate text-2xl font-black">{nonStriker?.name ?? "—"}</div>
          <div className="text-sm text-slate-300">{nonStriker?.runs} off {nonStriker?.balls}</div>
        </div>
      </div>

      <div className="fixed left-1/2 top-[6%] flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/70 px-4 py-2 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm sm:gap-3 sm:px-6 sm:text-xs">
        <Circle className="size-4 shrink-0" />
        <span className="max-w-32 truncate sm:max-w-none">Bowler: {bowler?.name ?? "—"}</span>
        <ChevronRight className="size-3 shrink-0" />
        <span className="shrink-0">{bowler?.overs ?? "0.0"} · {bowler?.wickets ?? 0} W · {bowler?.runsConceded ?? 0} R</span>
        <span className="shrink-0 text-slate-400">{connected ? "Live" : "Stale"}</span>
      </div>

      {banner && (
        <div className="pointer-events-none fixed left-1/2 top-[28%] flex -translate-x-1/2 flex-col items-center gap-2" style={{ animation: "bannerIn 0.4s ease-out" }}>
          {banner.kind === "4" && <div className="flex items-center gap-3 rounded-full bg-blue-600/90 px-8 py-3 text-4xl font-black shadow-[0_0_40px_rgba(59,130,246,0.6)]"><span>4</span><span>{banner.text}</span></div>}
          {banner.kind === "6" && <div className="flex items-center gap-3 rounded-full bg-orange-600/90 px-8 py-3 text-4xl font-black shadow-[0_0_40px_rgba(249,115,22,0.6)]"><span>6</span><span>{banner.text}</span></div>}
          {banner.kind === "W" && <div className="flex items-center gap-3 rounded-full bg-red-700/90 px-8 py-3 text-4xl font-black shadow-[0_0_40px_rgba(220,38,38,0.6)]"><Award className="size-8 animate-bounce" /><span>{banner.text}</span></div>}
        </div>
      )}

      <div className="fixed right-4 top-4">
        <span className={`rounded px-2 py-1 text-[10px] font-bold ${connected ? "bg-green-900/80 text-green-100" : "bg-red-900/80 text-red-100"}`}>{connected ? "Live feed" : "No feed"}</span>
      </div>

      <style>{`@keyframes bannerIn { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
    </div>
  )
}
