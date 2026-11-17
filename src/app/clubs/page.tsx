"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Building2, LoaderCircle, MapPin, Pencil, Plus, Save, Trash2, UsersRound, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { apiJson } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { isSuperadmin } from "@/lib/roles"

const schema = z.object({
  name: z.string().min(2, "Enter the club name"),
  shortName: z.string().max(6, "Use 6 characters or fewer").optional(),
  city: z.string().optional(),
})

type Club = {
  id: string
  name: string
  shortName: string | null
  city: string | null
}

export default function ClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState<Club | null>(null)
  const [editName, setEditName] = useState("")
  const [editShortName, setEditShortName] = useState("")
  const [editCity, setEditCity] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState("")
  const { session } = useSession()
  const superadmin = isSuperadmin(session?.role)
  const canCreate = superadmin
  const canEditClub = (club: Club) => superadmin || (session?.role === "ADMIN" && club.id === session.clubId)
  const canDeleteClub = superadmin
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", shortName: "", city: "" },
  })

  useEffect(() => {
    let active = true
    apiJson<Club[]>("/api/clubs")
      .then((data) => {
        if (active) setClubs(data)
      })
      .catch((cause: any) => {
        if (active) setError(cause.message ?? "Unable to load clubs")
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
      const created = await apiJson<Club>("/api/clubs", {
        method: "POST",
        body: {
          name: values.name,
          shortName: values.shortName || undefined,
          city: values.city || undefined,
        },
      })
      setClubs((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)))
      form.reset()
      setOpen(false)
    } catch (cause: any) {
      setError(cause.message ?? "Unable to create the club")
    } finally {
      setSubmitting(false)
    }
  }

  const startEditing = (club: Club) => {
    setEditing(club)
    setEditName(club.name)
    setEditShortName(club.shortName ?? "")
    setEditCity(club.city ?? "")
  }

  const saveEditing = async () => {
    if (!editing) return
    setSavingEdit(true)
    setError("")
    try {
      const updated = await apiJson<Club>(`/api/clubs/${editing.id}`, {
        method: "PATCH",
        body: {
          name: editName,
          shortName: editShortName || null,
          city: editCity || null,
        },
      })
      setClubs((current) => current.map((club) => club.id === updated.id ? updated : club))
      setEditing(null)
    } catch (cause: any) {
      setError(cause.message ?? "Unable to update the club")
    } finally {
      setSavingEdit(false)
    }
  }

  const deleteClub = async (club: Club) => {
    if (!window.confirm(`Delete ${club.name}? This also removes its players, squads, and match history.`)) return
    setDeletingId(club.id)
    setError("")
    try {
      await apiJson(`/api/clubs/${club.id}`, { method: "DELETE" })
      setClubs((current) => current.filter((item) => item.id !== club.id))
      if (editing?.id === club.id) setEditing(null)
    } catch (cause: any) {
      setError(cause.message ?? "Unable to delete the club")
    } finally {
      setDeletingId("")
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            <Building2 className="size-4" /> Club directory
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Clubs</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">Manage the teams taking part in your fixtures and tournaments.</p>
        </div>
        <Button onClick={() => setOpen((current) => !current)} disabled={!canCreate}>
          {open ? <X /> : <Plus />}
          {open ? "Close" : "Add club"}
        </Button>
      </div>

      {!canCreate && !loading && (
        <Alert className="mb-5">
          <AlertTitle>View-only access</AlertTitle>
          <AlertDescription>Super admins register clubs. Club admins can edit the club they manage.</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertTitle>Club action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {open && canCreate && (
        <Card className="mb-6 border-primary/20 bg-primary/[0.03]">
          <CardHeader>
            <CardTitle>Register a new club</CardTitle>
            <CardDescription>Add the full name, a short scorecard label, and the home city.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr_1fr_auto] lg:items-end">
              <div className="flex flex-col gap-2">
                <Label htmlFor="club-name">Club name</Label>
                <Input id="club-name" placeholder="Eagles Cricket Club" aria-invalid={Boolean(form.formState.errors.name)} {...form.register("name")} />
                {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="club-short-name">Short name</Label>
                <Input id="club-short-name" placeholder="EAG" {...form.register("shortName")} />
                {form.formState.errors.shortName && <p className="text-sm text-destructive">{form.formState.errors.shortName.message}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="club-city">City</Label>
                <Input id="club-city" placeholder="London" {...form.register("city")} />
              </div>
              <Button type="submit" className="h-10" disabled={submitting}>
                {submitting && <LoaderCircle className="animate-spin" />}
                Create club
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {editing && (
        <Card className="mb-6 border-primary/30 bg-primary/[0.03]">
          <CardHeader>
            <CardTitle>Edit {editing.name}</CardTitle>
            <CardDescription>Update the club name, scorecard label, and city.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr_1fr_auto] lg:items-end">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-club-name">Club name</Label>
                <Input id="edit-club-name" value={editName} onChange={(event) => setEditName(event.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-club-short-name">Short name</Label>
                <Input id="edit-club-short-name" value={editShortName} onChange={(event) => setEditShortName(event.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-club-city">City</Label>
                <Input id="edit-club-city" value={editCity} onChange={(event) => setEditCity(event.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={saveEditing} disabled={savingEdit || editName.trim().length < 2}>
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
      ) : clubs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted"><UsersRound className="text-muted-foreground" /></span>
            <h2 className="mt-4 font-semibold">No clubs registered yet</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Register your first club to start creating fixtures and team squads.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:hidden">
            {clubs.map((club) => (
              <Card key={club.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 font-black text-primary">{club.shortName || club.name.slice(0, 2).toUpperCase()}</div>
                    <Badge variant="outline">Club</Badge>
                  </div>
                  <h2 className="mt-4 font-bold">{club.name}</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="size-4" />{club.city || "City not set"}</p>
                  {(canEditClub(club) || canDeleteClub) && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                      {canEditClub(club) && (
                        <Button variant="outline" size="sm" onClick={() => startEditing(club)} aria-label={`Edit ${club.name}`}>
                          <Pencil />Edit
                        </Button>
                      )}
                      {canDeleteClub && (
                        <Button variant="destructive" size="sm" onClick={() => deleteClub(club)} disabled={deletingId === club.id} aria-label={`Delete ${club.name}`}>
                          {deletingId === club.id ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                          Delete
                        </Button>
                      )}
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
                  <TableHead>Club</TableHead>
                  <TableHead>Short name</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clubs.map((club) => (
                  <TableRow key={club.id}>
                    <TableCell className="font-semibold">{club.name}</TableCell>
                    <TableCell>{club.shortName || "—"}</TableCell>
                    <TableCell>{club.city || "—"}</TableCell>
                    <TableCell className="text-right"><Badge variant="secondary">Active</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canEditClub(club) && (
                          <Button variant="outline" size="sm" onClick={() => startEditing(club)} aria-label={`Edit ${club.name}`}>
                            <Pencil />Edit
                          </Button>
                        )}
                        {canDeleteClub && (
                          <Button variant="destructive" size="sm" onClick={() => deleteClub(club)} disabled={deletingId === club.id} aria-label={`Delete ${club.name}`}>
                            {deletingId === club.id ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                            Delete
                          </Button>
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
