"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowRight, LoaderCircle, Pencil, Plus, Save, Shirt, Trash2, UserRound, UsersRound, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiJson } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { isManager, isSuperadmin } from "@/lib/roles"

const schema = z.object({
  clubId: z.string().min(1, "Select a club"),
  name: z.string().min(2, "Enter the player name"),
  jerseyNumber: z.number().int().min(0).max(99).optional(),
  role: z.enum(["BATTER", "BOWLER", "ALL_ROUNDER", "WICKET_KEEPER"]),
})

type Club = { id: string; name: string }
type Player = { id: string; clubId: string; name: string; jerseyNumber: number | null; role: string; club?: Club }

export default function PlayersPage() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [clubFilter, setClubFilter] = useState("ALL")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState<Player | null>(null)
  const [editValues, setEditValues] = useState({ name: "", jerseyNumber: "", role: "BATTER" })
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState("")
  const { session } = useSession()
  const canManage = isManager(session?.role)
  const manageableClubs = isSuperadmin(session?.role)
    ? clubs
    : clubs.filter((club) => club.id === session?.clubId)
  const canEditPlayer = (player: Player) => isSuperadmin(session?.role) || (session?.role === "ADMIN" && player.clubId === session.clubId)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { clubId: "", name: "", jerseyNumber: undefined, role: "BATTER" },
  })

  useEffect(() => {
    let active = true
    Promise.all([apiJson<Club[]>("/api/clubs"), apiJson<Player[]>("/api/players")])
      .then(([clubData, playerData]) => {
        if (!active) return
        setClubs(clubData)
        setPlayers(playerData)
        const ownClub = session?.role === "ADMIN" ? clubData.find((club) => club.id === session.clubId) : undefined
        const fallback = ownClub ?? clubData[0]
        if (fallback) form.setValue("clubId", fallback.id)
      })
      .catch((cause: any) => {
        if (active) setError(cause.message ?? "Unable to load players")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [form, session?.clubId, session?.role])

  const visiblePlayers = useMemo(
    () => clubFilter === "ALL" ? players : players.filter((player) => player.clubId === clubFilter),
    [clubFilter, players],
  )

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setError("")
    setSubmitting(true)
    try {
      const created = await apiJson<Player>("/api/players", {
        method: "POST",
        body: {
          clubId: values.clubId,
          name: values.name,
          jerseyNumber: values.jerseyNumber,
          role: values.role,
        },
      })
      setPlayers((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)))
      form.reset()
      setOpen(false)
    } catch (cause: any) {
      setError(cause.message ?? "Unable to add the player")
    } finally {
      setSubmitting(false)
    }
  }

  const startEditing = (player: Player) => {
    setEditing(player)
    setEditValues({
      name: player.name,
      jerseyNumber: player.jerseyNumber === null ? "" : String(player.jerseyNumber),
      role: player.role,
    })
  }

  const saveEditing = async () => {
    if (!editing) return
    setSavingEdit(true)
    setError("")
    try {
      const updated = await apiJson<Player>(`/api/players/${editing.id}`, {
        method: "PATCH",
        body: {
          name: editValues.name,
          jerseyNumber: editValues.jerseyNumber === "" ? null : Number(editValues.jerseyNumber),
          role: editValues.role,
        },
      })
      setPlayers((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item))
      setEditing(null)
    } catch (cause: any) {
      setError(cause.message ?? "Unable to update the player")
    } finally {
      setSavingEdit(false)
    }
  }

  const deletePlayer = async (player: Player) => {
    if (!window.confirm(`Delete ${player.name} from ${clubName(player.clubId)}?`)) return
    setDeletingId(player.id)
    setError("")
    try {
      await apiJson(`/api/players/${player.id}`, { method: "DELETE" })
      setPlayers((current) => current.filter((item) => item.id !== player.id))
      if (editing?.id === player.id) setEditing(null)
    } catch (cause: any) {
      setError(cause.message ?? "Unable to delete the player")
    } finally {
      setDeletingId("")
    }
  }

  const clubName = (clubId: string) => clubs.find((club) => club.id === clubId)?.name ?? "Unknown club"

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary"><UsersRound className="size-4" /> Player registry</div>
          <h1 className="text-3xl font-bold tracking-tight">Players</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">Manage club rosters and keep player profiles ready for match selection.</p>
        </div>
        <Button onClick={() => setOpen((current) => !current)} disabled={!canManage}>{open ? <X /> : <Plus />}{open ? "Close" : "Add player"}</Button>
      </div>

      {!canManage && !loading && <Alert className="mb-5"><AlertTitle>View-only access</AlertTitle><AlertDescription>Club admins manage their own roster. Super admins can manage every roster.</AlertDescription></Alert>}
      {error && <Alert variant="destructive" className="mb-5"><AlertTitle>Player action failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

      {open && canManage && (
        <Card className="mb-6 border-primary/20 bg-primary/[0.03]">
          <CardHeader><CardTitle>Register a player</CardTitle><CardDescription>Add a player to a club roster. Jersey numbers must be unique within that club.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5 lg:grid-cols-[1fr_1.2fr_0.7fr_1fr_auto] lg:items-end">
              <div className="flex flex-col gap-2"><Label>Club</Label><Controller control={form.control} name="clubId" render={({ field }) => <Select value={field.value} onValueChange={field.onChange}><SelectTrigger className="w-full"><SelectValue placeholder="Select club" /></SelectTrigger><SelectContent><SelectGroup>{manageableClubs.map((club) => <SelectItem key={club.id} value={club.id}>{club.name}</SelectItem>)}</SelectGroup></SelectContent></Select>} /></div>
              <div className="flex flex-col gap-2"><Label htmlFor="player-name">Player name</Label><Input id="player-name" placeholder="J. Taylor" {...form.register("name")} /></div>
              <div className="flex flex-col gap-2"><Label htmlFor="jersey-number">Jersey no.</Label><Input id="jersey-number" type="number" min={0} max={99} {...form.register("jerseyNumber", { valueAsNumber: true })} /></div>
              <div className="flex flex-col gap-2"><Label>Role</Label><Controller control={form.control} name="role" render={({ field }) => <Select value={field.value} onValueChange={field.onChange}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="BATTER">Batter</SelectItem><SelectItem value="BOWLER">Bowler</SelectItem><SelectItem value="ALL_ROUNDER">All-rounder</SelectItem><SelectItem value="WICKET_KEEPER">Wicketkeeper</SelectItem></SelectGroup></SelectContent></Select>} /></div>
              <Button type="submit" disabled={submitting}>{submitting && <LoaderCircle className="animate-spin" />}Add player</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {editing && (
        <Card className="mb-6 border-primary/30 bg-primary/[0.03]">
          <CardHeader>
            <CardTitle>Edit {editing.name}</CardTitle>
            <CardDescription>Update the player profile for {clubName(editing.clubId)}.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.7fr_1fr_auto] lg:items-end">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-player-name">Player name</Label>
                <Input id="edit-player-name" value={editValues.name} onChange={(event) => setEditValues((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-jersey-number">Jersey no.</Label>
                <Input id="edit-jersey-number" type="number" min={0} max={99} value={editValues.jerseyNumber} onChange={(event) => setEditValues((current) => ({ ...current, jerseyNumber: event.target.value }))} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-player-role">Role</Label>
                <Select value={editValues.role} onValueChange={(value) => setEditValues((current) => ({ ...current, role: value }))}>
                  <SelectTrigger id="edit-player-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="BATTER">Batter</SelectItem>
                      <SelectItem value="BOWLER">Bowler</SelectItem>
                      <SelectItem value="ALL_ROUNDER">All-rounder</SelectItem>
                      <SelectItem value="WICKET_KEEPER">Wicketkeeper</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
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

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={() => setClubFilter("ALL")} className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold ${clubFilter === "ALL" ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>All clubs</button>
        {clubs.map((club) => <button key={club.id} type="button" onClick={() => setClubFilter(club.id)} className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold ${clubFilter === club.id ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>{club.name}</button>)}
      </div>

      {loading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-40 animate-pulse rounded-xl bg-muted" />)}</div> : visiblePlayers.length === 0 ? (
        <Card className="border-dashed"><CardContent className="flex flex-col items-center py-14 text-center"><span className="flex size-12 items-center justify-center rounded-full bg-muted"><UserRound className="text-muted-foreground" /></span><h2 className="mt-4 font-semibold">No players found</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">Add players to club rosters before creating match XIs.</p></CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:hidden">
            {visiblePlayers.map((player) => (
              <Card key={player.id}>
                <CardContent className="p-5">
                  <Link href={`/players/${player.id}`} className="block">
                    <div className="flex items-start justify-between"><div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 font-black text-primary">{player.jerseyNumber ?? "—"}</div><Badge variant="outline">{player.role.replaceAll("_", " ").toLowerCase()}</Badge></div>
                    <h2 className="mt-4 font-bold">{player.name}</h2>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Shirt className="size-4" />{clubName(player.clubId)}</p>
                    <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">View career <ArrowRight className="size-3" /></p>
                  </Link>
                  {canEditPlayer(player) && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                      <Button variant="outline" size="sm" onClick={() => startEditing(player)} aria-label={`Edit ${player.name}`}>
                        <Pencil />Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => deletePlayer(player)} disabled={deletingId === player.id} aria-label={`Delete ${player.name}`}>
                        {deletingId === player.id ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                        Delete
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="hidden overflow-hidden lg:block"><Table><TableHeader><TableRow><TableHead>Player</TableHead><TableHead>Club</TableHead><TableHead className="text-right">Jersey</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Profile</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{visiblePlayers.map((player) => (
            <TableRow key={player.id}>
              <TableCell className="font-semibold">{player.name}</TableCell>
              <TableCell>{clubName(player.clubId)}</TableCell>
              <TableCell className="text-right">{player.jerseyNumber ?? "—"}</TableCell>
              <TableCell>{player.role.replaceAll("_", " ").toLowerCase()}</TableCell>
              <TableCell className="text-right"><Button asChild variant="ghost" size="sm"><Link href={`/players/${player.id}`}>View <ArrowRight /></Link></Button></TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {canEditPlayer(player) && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => startEditing(player)} aria-label={`Edit ${player.name}`}>
                        <Pencil />Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => deletePlayer(player)} disabled={deletingId === player.id} aria-label={`Delete ${player.name}`}>
                        {deletingId === player.id ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}</TableBody></Table></Card>
        </>
      )}
    </div>
  )
}
