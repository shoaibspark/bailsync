"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import toast from "react-hot-toast"
import { ArrowLeft, ArrowRight, CalendarDays, LoaderCircle, MapPin, Swords } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiJson } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { isManager } from "@/lib/roles"

const schema = z.object({
  homeClubId: z.string().min(1, "Select the home club"),
  awayClubId: z.string().min(1, "Select the away club"),
  tournamentId: z.string().optional(),
  venue: z.string().min(2, "Enter the venue"),
  scheduledAt: z.string().optional(),
  oversPerInnings: z.number().int().min(1).max(50),
  maxOversPerBowler: z.number().int().min(1).max(20),
}).refine((values) => values.homeClubId !== values.awayClubId, {
  message: "Home and away clubs must be different",
  path: ["awayClubId"],
})

type Club = { id: string; name: string; shortName: string | null; city: string | null }
type Tournament = { id: string; name: string }
type CreatedMatch = { id: string }

export default function NewMatchPage() {
  const router = useRouter()
  const [clubs, setClubs] = useState<Club[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const { session, status } = useSession()
  const sessionLoading = status === "loading"
  const canManage = isManager(session?.role)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      homeClubId: "",
      awayClubId: "",
      tournamentId: "",
      venue: "",
      scheduledAt: "",
      oversPerInnings: 20,
      maxOversPerBowler: 4,
    },
  })

  useEffect(() => {
    let active = true
    Promise.all([apiJson<Club[]>("/api/clubs"), apiJson<Tournament[]>("/api/tournaments")])
      .then(([clubData, tournamentData]) => {
        if (!active) return
        setClubs(clubData)
        setTournaments(tournamentData)
        const ownClub = session?.role === "ADMIN" ? clubData.find((club) => session.clubIds.includes(club.id)) : undefined
        const home = ownClub ?? clubData[0]
        const away = clubData.find((club) => club.id !== home?.id)
        if (home) form.setValue("homeClubId", home.id)
        if (away) form.setValue("awayClubId", away.id)
      })
      .catch((cause: any) => {
        if (active) toast.error(cause.message ?? "Unable to load match options")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [form, session?.clubIds, session?.role])

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setSubmitting(true)
    try {
      const match = await apiJson<CreatedMatch>("/api/matches", {
        method: "POST",
        body: {
          homeClubId: values.homeClubId,
          awayClubId: values.awayClubId,
          tournamentId: values.tournamentId || undefined,
          venue: values.venue,
          scheduledAt: values.scheduledAt ? new Date(values.scheduledAt).toISOString() : undefined,
          oversPerInnings: values.oversPerInnings,
          maxOversPerBowler: values.maxOversPerBowler,
        },
      })
      toast.success("Match scheduled")
      router.push(`/matches/${match.id}/setup`)
      router.refresh()
    } catch (cause: any) {
      toast.error(cause.message ?? "Unable to create the match")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-4 sm:px-6 sm:py-9 lg:px-8">
      <Button asChild variant="ghost" size="sm" className="mb-5 -ml-2"><Link href="/matches"><ArrowLeft />Back to matches</Link></Button>
      <div className="mb-7">
        <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary sm:text-xs"><Swords className="size-4" /> New fixture</div>
        <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight sm:text-3xl sm:text-4xl">
          Create a match
          {!sessionLoading && !canManage && <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px] sm:text-xs">View only</Badge>}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">Choose the teams and basic rules. You’ll confirm the toss and XIs in the next step.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Fixture details</CardTitle><CardDescription>Both clubs need at least 11 registered players before scoring can begin.</CardDescription></CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-80 animate-pulse rounded-xl bg-muted" />
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Home club</Label>
                  <Controller control={form.control} name="homeClubId" render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select home club" /></SelectTrigger>
                      <SelectContent><SelectGroup>{clubs.map((club) => <SelectItem key={club.id} value={club.id}>{club.name}</SelectItem>)}</SelectGroup></SelectContent>
                    </Select>
                  )} />
                  {form.formState.errors.homeClubId && <p className="text-sm text-destructive">{form.formState.errors.homeClubId.message}</p>}
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Away club</Label>
                  <Controller control={form.control} name="awayClubId" render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select away club" /></SelectTrigger>
                      <SelectContent><SelectGroup>{clubs.map((club) => <SelectItem key={club.id} value={club.id}>{club.name}</SelectItem>)}</SelectGroup></SelectContent>
                    </Select>
                  )} />
                  {form.formState.errors.awayClubId && <p className="text-sm text-destructive">{form.formState.errors.awayClubId.message}</p>}
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Tournament</Label>
                  <Controller control={form.control} name="tournamentId" render={({ field }) => (
                    <Select value={field.value || "friendly"} onValueChange={(value) => field.onChange(value === "friendly" ? "" : value)}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Friendly match" /></SelectTrigger>
                      <SelectContent><SelectGroup><SelectItem value="friendly">Friendly match</SelectItem>{tournaments.map((tournament) => <SelectItem key={tournament.id} value={tournament.id}>{tournament.name}</SelectItem>)}</SelectGroup></SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="flex flex-col gap-2"><Label htmlFor="venue">Venue</Label><div className="relative"><MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="venue" className="pl-9" placeholder="City Ground" {...form.register("venue")} /></div>{form.formState.errors.venue && <p className="text-sm text-destructive">{form.formState.errors.venue.message}</p>}</div>
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor="scheduled-at">Start time</Label><div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="scheduled-at" type="datetime-local" className="pl-9" {...form.register("scheduledAt")} /></div></div>
                <div className="flex flex-col gap-2"><Label htmlFor="new-overs">Overs</Label><Input id="new-overs" type="number" min={1} max={50} {...form.register("oversPerInnings", { valueAsNumber: true })} /></div>
                <div className="flex flex-col gap-2"><Label htmlFor="new-max-overs">Max per bowler</Label><Input id="new-max-overs" type="number" min={1} max={20} {...form.register("maxOversPerBowler", { valueAsNumber: true })} /></div>
              </div>

              <div className="flex justify-end border-t pt-5">
                <Button type="submit" size="lg" disabled={!canManage || submitting}>
                  {submitting ? <LoaderCircle className="animate-spin" /> : null}
                  {submitting ? "Creating match…" : "Create and continue"}
                  {!submitting && <ArrowRight />}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
