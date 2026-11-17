"use client"

import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { CalendarDays, LoaderCircle, Pencil, Plus, Save, Trash2, Trophy, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { apiJson } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { isManager, isSuperadmin } from "@/lib/roles"

const schema = z.object({
  name: z.string().min(2, "Enter the tournament name"),
  format: z.enum(["LEAGUE", "KNOCKOUT", "GROUP_KNOCKOUT"]),
  oversPerInnings: z.number().int().min(1).max(50),
  maxOversPerBowler: z.number().int().min(1).max(20),
  ballsPerOver: z.number().int().min(1).max(12),
  wideRuns: z.number().int().min(0).max(10),
  noBallRuns: z.number().int().min(0).max(10),
  lastManStands: z.boolean(),
})

type Tournament = {
  id: string
  name: string
  format: "LEAGUE" | "KNOCKOUT" | "GROUP_KNOCKOUT"
  oversPerInnings: number
  maxOversPerBowler: number
  ballsPerOver: number
  wideRuns: number
  noBallRuns: number
  lastManStands: boolean
  managerId: string | null
}

const formatLabels = {
  LEAGUE: "League",
  KNOCKOUT: "Knockout",
  GROUP_KNOCKOUT: "Group + knockout",
}

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState<Tournament | null>(null)
  const [editValues, setEditValues] = useState({ name: "", format: "LEAGUE" as Tournament["format"], oversPerInnings: 20, maxOversPerBowler: 4, ballsPerOver: 6 })
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState("")
  const { session } = useSession()
  const canManage = isManager(session?.role)
  const canEditTournament = (tournament: Tournament) => isSuperadmin(session?.role) || (session?.role === "ADMIN" && tournament.managerId === session.userId)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      format: "LEAGUE",
      oversPerInnings: 20,
      maxOversPerBowler: 4,
      ballsPerOver: 6,
      wideRuns: 1,
      noBallRuns: 1,
      lastManStands: false,
    },
  })

  useEffect(() => {
    let active = true
    apiJson<Tournament[]>("/api/tournaments")
      .then((data) => {
        if (active) setTournaments(data)
      })
      .catch((cause: any) => {
        if (active) setError(cause.message ?? "Unable to load tournaments")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setError("")
    setSubmitting(true)
    try {
      const created = await apiJson<Tournament>("/api/tournaments", {
        method: "POST",
        body: values,
      })
      setTournaments((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)))
      form.reset()
      setOpen(false)
    } catch (cause: any) {
      setError(cause.message ?? "Unable to create the tournament")
    } finally {
      setSubmitting(false)
    }
  }

  const startEditing = (tournament: Tournament) => {
    setEditing(tournament)
    setEditValues({
      name: tournament.name,
      format: tournament.format,
      oversPerInnings: tournament.oversPerInnings,
      maxOversPerBowler: tournament.maxOversPerBowler,
      ballsPerOver: tournament.ballsPerOver,
    })
  }

  const saveEditing = async () => {
    if (!editing) return
    setSavingEdit(true)
    setError("")
    try {
      const updated = await apiJson<Tournament>(`/api/tournaments/${editing.id}`, {
        method: "PATCH",
        body: editValues,
      })
      setTournaments((current) => current.map((item) => item.id === updated.id ? updated : item))
      setEditing(null)
    } catch (cause: any) {
      setError(cause.message ?? "Unable to update the tournament")
    } finally {
      setSavingEdit(false)
    }
  }

  const deleteTournament = async (tournament: Tournament) => {
    if (!window.confirm(`Delete ${tournament.name}? Fixtures stay in place but lose their competition.`)) return
    setDeletingId(tournament.id)
    setError("")
    try {
      await apiJson(`/api/tournaments/${tournament.id}`, { method: "DELETE" })
      setTournaments((current) => current.filter((item) => item.id !== tournament.id))
      if (editing?.id === tournament.id) setEditing(null)
    } catch (cause: any) {
      setError(cause.message ?? "Unable to delete the tournament")
    } finally {
      setDeletingId("")
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            <Trophy className="size-4" /> Competition centre
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Tournaments</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">Set the format and scoring rules for every fixture in an event.</p>
        </div>
        <Button onClick={() => setOpen((current) => !current)} disabled={!canManage}>
          {open ? <X /> : <Plus />}
          {open ? "Close" : "Create tournament"}
        </Button>
      </div>

      {!canManage && !loading && (
        <Alert className="mb-5">
          <AlertTitle>View-only access</AlertTitle>
          <AlertDescription>Admins and super admins create and edit competitions.</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertTitle>Tournament action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {open && canManage && (
        <Card className="mb-6 border-primary/20 bg-primary/[0.03]">
          <CardHeader>
            <CardTitle>Create a tournament</CardTitle>
            <CardDescription>These defaults can be adjusted on each match during setup.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="tournament-name">Tournament name</Label>
                  <Input id="tournament-name" placeholder="Summer League 2026" aria-invalid={Boolean(form.formState.errors.name)} {...form.register("name")} />
                  {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-1">
                  <Label>Format</Label>
                  <Controller
                    control={form.control}
                    name="format"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="LEAGUE">League</SelectItem>
                            <SelectItem value="KNOCKOUT">Knockout</SelectItem>
                            <SelectItem value="GROUP_KNOCKOUT">Group + knockout</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="overs">Overs per innings</Label>
                  <Input id="overs" type="number" min={1} max={50} {...form.register("oversPerInnings", { valueAsNumber: true })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="max-overs">Max overs per bowler</Label>
                  <Input id="max-overs" type="number" min={1} max={20} {...form.register("maxOversPerBowler", { valueAsNumber: true })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="balls">Balls per over</Label>
                  <Input id="balls" type="number" min={1} max={12} {...form.register("ballsPerOver", { valueAsNumber: true })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="wide-runs">Wide penalty</Label>
                  <Input id="wide-runs" type="number" min={0} max={10} {...form.register("wideRuns", { valueAsNumber: true })} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="no-ball-runs">No-ball penalty</Label>
                  <Input id="no-ball-runs" type="number" min={0} max={10} {...form.register("noBallRuns", { valueAsNumber: true })} />
                </div>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Controller
                  control={form.control}
                  name="lastManStands"
                  render={({ field }) => (
                    <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
                      <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                      Last man stands
                    </label>
                  )}
                />
                <Button type="submit" disabled={submitting}>
                  {submitting && <LoaderCircle className="animate-spin" />}
                  Create tournament
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {editing && (
        <Card className="mb-6 border-primary/30 bg-primary/[0.03]">
          <CardHeader>
            <CardTitle>Edit {editing.name}</CardTitle>
            <CardDescription>Adjust the format and scoring limits for this competition.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr_0.6fr_0.6fr_0.6fr_auto] lg:items-end">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-tournament-name">Tournament name</Label>
                <Input id="edit-tournament-name" value={editValues.name} onChange={(event) => setEditValues((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-tournament-format">Format</Label>
                <Select value={editValues.format} onValueChange={(value) => setEditValues((current) => ({ ...current, format: value as Tournament["format"] }))}>
                  <SelectTrigger id="edit-tournament-format"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="LEAGUE">League</SelectItem>
                      <SelectItem value="KNOCKOUT">Knockout</SelectItem>
                      <SelectItem value="GROUP_KNOCKOUT">Group + knockout</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-tournament-overs">Overs</Label>
                <Input id="edit-tournament-overs" type="number" min={1} max={50} value={editValues.oversPerInnings} onChange={(event) => setEditValues((current) => ({ ...current, oversPerInnings: Number(event.target.value) }))} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-tournament-max-overs">Max per bowler</Label>
                <Input id="edit-tournament-max-overs" type="number" min={1} max={20} value={editValues.maxOversPerBowler} onChange={(event) => setEditValues((current) => ({ ...current, maxOversPerBowler: Number(event.target.value) }))} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-tournament-balls">Balls per over</Label>
                <Input id="edit-tournament-balls" type="number" min={1} max={12} value={editValues.ballsPerOver} onChange={(event) => setEditValues((current) => ({ ...current, ballsPerOver: Number(event.target.value) }))} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={saveEditing} disabled={savingEdit || editValues.name.trim().length < 2}>
                  {savingEdit ? <LoaderCircle className="animate-spin" /> : <Save />}
                  Save changes
                </Button>
                <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => <div key={item} className="h-40 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : tournaments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted"><CalendarDays className="text-muted-foreground" /></span>
            <h2 className="mt-4 font-semibold">No tournaments yet</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Create your first competition, then add fixtures and teams.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:hidden">
            {tournaments.map((tournament) => (
              <Card key={tournament.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Trophy /></div>
                    <Badge variant="secondary">{formatLabels[tournament.format]}</Badge>
                  </div>
                  <h2 className="mt-4 font-bold">{tournament.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{tournament.oversPerInnings} overs · {tournament.maxOversPerBowler} overs per bowler</p>
                  {canEditTournament(tournament) && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                      <Button variant="outline" size="sm" onClick={() => startEditing(tournament)} aria-label={`Edit ${tournament.name}`}>
                        <Pencil />Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => deleteTournament(tournament)} disabled={deletingId === tournament.id} aria-label={`Delete ${tournament.name}`}>
                        {deletingId === tournament.id ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                        Delete
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="hidden overflow-hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tournament</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead className="text-right">Overs</TableHead>
                  <TableHead className="text-right">Max per bowler</TableHead>
                  <TableHead className="text-right">Last man</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tournaments.map((tournament) => (
                  <TableRow key={tournament.id}>
                    <TableCell className="font-semibold">{tournament.name}</TableCell>
                    <TableCell>{formatLabels[tournament.format]}</TableCell>
                    <TableCell className="text-right">{tournament.oversPerInnings}</TableCell>
                    <TableCell className="text-right">{tournament.maxOversPerBowler}</TableCell>
                    <TableCell className="text-right">{tournament.lastManStands ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canEditTournament(tournament) && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => startEditing(tournament)} aria-label={`Edit ${tournament.name}`}>
                              <Pencil />Edit
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => deleteTournament(tournament)} disabled={deletingId === tournament.id} aria-label={`Delete ${tournament.name}`}>
                              {deletingId === tournament.id ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  )
}
