"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, CloudUpload, LoaderCircle, WifiOff } from "lucide-react"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { flushAllQueue, offlineQueue } from "@/lib/offline-queue"

export default function OfflinePage() {
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    offlineQueue.count().then(setPending)
  }, [])

  const retry = async () => {
    setSyncing(true)
    try {
      const result = await flushAllQueue()
      const count = await offlineQueue.count()
      setPending(count)
      if (result.flushed) toast.success(`${result.flushed} queued deliveries synced`)
      else toast.error("No queued deliveries could be synced yet")
    } catch {
      toast.error("Still offline. Your deliveries remain safely stored on this device.")
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-2xl items-center px-4 py-10 sm:px-6">
      <Card className="mx-auto w-full shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-muted"><WifiOff className="text-muted-foreground" /></div>
          <CardTitle className="mt-2 text-2xl">You’re offline</CardTitle>
          <CardDescription className="mx-auto max-w-md">Bailsync keeps scoring on this device. Deliveries stay queued and sync automatically when the connection returns.</CardDescription>
        </CardHeader>
        <CardContent>
          {pending > 0 ? (
            <Alert className="mb-5"><CloudUpload /><AlertTitle>{pending} deliveries waiting</AlertTitle><AlertDescription>Do not clear your browser data until every delivery has synced.</AlertDescription></Alert>
          ) : (
            <Alert className="mb-5"><AlertTitle>Everything is synced</AlertTitle><AlertDescription>There are no pending deliveries on this device.</AlertDescription></Alert>
          )}
          {pending > 0 && <Progress value={0} className="mb-5" aria-label="Pending deliveries have not synced" />}
          <Button onClick={retry} className="w-full" disabled={syncing}>
            {syncing ? <LoaderCircle className="animate-spin" /> : <CloudUpload />}
            {syncing ? "Trying to sync…" : "Retry connection"}
          </Button>
        </CardContent>
        <CardFooter className="flex-col gap-3 border-t pt-6">
          <p className="text-center text-xs text-muted-foreground">Return to the scoring console and continue recording balls.</p>
          <Button asChild variant="ghost" className="w-full"><Link href="/matches">Open match centre<ArrowRight /></Link></Button>
        </CardFooter>
      </Card>
    </div>
  )
}
