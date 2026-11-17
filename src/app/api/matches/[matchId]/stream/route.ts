import type { NextRequest } from "next/server"
import { sseHub } from "@/lib/realtime/sse-hub"
import { encodeHeartbeat, encodeSseFrame } from "@/lib/wire-codec"
import { getMatchStateSnapshot } from "@/lib/cricket-engine/match-state"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const HEARTBEAT_MS = 15000

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { matchId } = await params
  const encoder = new TextEncoder()
  let cleanup = () => {}

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false
      let heartbeat: ReturnType<typeof setInterval> | null = null
      let unsubscribe = () => {}

      const close = () => {
        if (closed) return
        closed = true
        if (heartbeat) clearInterval(heartbeat)
        unsubscribe()
        try {
          controller.close()
        } catch {}
      }

      const snapshot = await getMatchStateSnapshot(matchId)
      if (!snapshot) {
        close()
        return
      }

      controller.enqueue(encoder.encode(encodeSseFrame(snapshot, "snapshot")))

      heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(encodeHeartbeat()))
      }, HEARTBEAT_MS)

      unsubscribe = sseHub.subscribe(matchId, (state) => {
        if (!closed) controller.enqueue(encoder.encode(encodeSseFrame(state, "state")))
      })

      cleanup = close
      req.signal.addEventListener("abort", close, { once: true })
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
