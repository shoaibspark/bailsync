"use client"

import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import toast from "react-hot-toast"
import { Building2, LoaderCircle, MapPin, Pencil, Plus, Save, Search, Trash2, UsersRound, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { TablePagination } from "@/components/table-pagination"
import { SelectionBar, SelectionCheck } from "@/components/selection-bar"
import { CachedSkeleton } from "@/components/cached-skeleton"
import { apiJson } from "@/lib/api-client"
import { useCachedData } from "@/hooks/use-cached-data"
import { useLongPressSelect } from "@/hooks/use-long-press-select"
import { useSession } from "@/hooks/use-session"
import { isSuperadmin } from "@/lib/roles"
import { cn } from "@/lib/utils"

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
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState<Club | null>(null)
  const [editName, setEditName] = useState("")
  const [editShortName, setEditShortName] = useState("")
  const [editCity, setEditCity] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectionMode, setSelectionMode] = useState(false)
  const { session, status } = useSession()
  const sessionLoading = status === "loading"
  const superadmin = isSuperadmin(session?.role)
  const canCreate = superadmin
  const canEditClub = (club: Club) => superadmin || (session?.role === "ADMIN" && session.clubIds.includes(club.id))
  const canDeleteClub = superadmin
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", shortName: "", city: "" },
  })

  const clubsCache = useCachedData<Club[]>("clubs:list", () => apiJson<Club[]>("/api/clubs"))
  const clubs = clubsCache.data ?? []
  const loading = clubsCache.isLoading && !clubs.length

  const filteredClubs = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return clubs
    return clubs.filter((club) =>
      [club.name, club.shortName, club.city].filter(Boolean).some((field) => String(field).toLowerCase().includes(term)),
    )
  }, [clubs, query])

  const pageCount = Math.max(1, Math.ceil(filteredClubs.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleClubs = filteredClubs.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const selectableIds = canDeleteClub ? visibleClubs.map((club) => club.id) : []
  const allVisibleSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.includes(id))

  const toggleAll = () => {
    setSelected((current) =>
      allVisibleSelected
        ? current.filter((id) => !selectableIds.includes(id))
        : Array.from(new Set([...current, ...selectableIds])),
    )
  }

  const toggleOne = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  const { handlers: longPressHandlers } = useLongPressSelect({
    onLongPress: (id) => {
      setSelectionMode(true)
      setSelected((current) => (current.includes(id) ? current : [...current, id]))
    },
  })

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setSubmitting(true)
    try {
      await apiJson<Club>("/api/clubs", {
        method: "POST",
        body: {
          name: values.name,
          shortName: values.shortName || undefined,
          city: values.city || undefined,
        },
      })
      form.reset()
      setOpen(false)
      await clubsCache.refresh()
      toast.success("Club created")
    } catch (cause: any) {
      toast.error(cause.message ?? "Unable to create the club")
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
    try {
      await apiJson<Club>(`/api/clubs/${editing.id}`, {
        method: "PATCH",
        body: {
          name: editName,
          shortName: editShortName || null,
          city: editCity || null,
        },
      })
      setEditing(null)
      await clubsCache.refresh()
      toast.success("Club updated")
    } catch (cause: any) {
      toast.error(cause.message ?? "Unable to update the club")
    } finally {
      setSavingEdit(false)
    }
  }

  const deleteClub = async (club: Club) => {
    if (!window.confirm(`Delete ${club.name}? This also removes its players, squads, and match history.`)) return
    setDeletingId(club.id)
    try {
      await apiJson(`/api/clubs/${club.id}`, { method: "DELETE" })
      setSelected((current) => current.filter((id) => id !== club.id))
      if (editing?.id === club.id) setEditing(null)
      await clubsCache.refresh()
      toast.success("Club deleted")
    } catch (cause: any) {
      toast.error(cause.message ?? "Unable to delete the club")
    } finally {
      setDeletingId("")
    }
  }

  const bulkDelete = async () => {
    if (!selected.length) return
    const deleteCount = selected.length
    if (!window.confirm(`Delete ${deleteCount} club${deleteCount === 1 ? "" : "s"}? Players, squads, and match history will be removed.`)) return
    setBulkDeleting(true)
    try {
      for (const id of selected) {
        await apiJson(`/api/clubs/${id}`, { method: "DELETE" })
      }
      setSelected([])
      await clubsCache.refresh()
      toast.success(`${deleteCount} clubs deleted`)
    } catch (cause: any) {
      toast.error(cause.message ?? "Unable to delete the selected clubs")
    } finally {
      setBulkDeleting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary sm:text-xs">
            <Building2 className="size-4" /> Club directory
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight sm:text-3xl">Clubs</h1>
            {status !== "loading" && !superadmin && session?.role !== "ADMIN" && (
              <Badge variant="outline" className="shrink-0 text-[10px]">View only</Badge>
            )}
          </div>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm sm:text-base">Manage the teams taking part in your fixtures and tournaments.</p>
        </div>
        <Button onClick={() => setOpen((current) => !current)} disabled={!canCreate} className="h-8 w-full text-xs sm:h-9 sm:w-auto sm:text-sm">
          {open ? <X /> : <Plus />}
          {open ? "Close" : "Add club"}
        </Button>
      </div>

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
              <Button type="submit" className="h-8 text-xs sm:h-9 sm:text-sm" disabled={submitting}>
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

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
            placeholder="Search clubs"
            className="h-8 pl-8 text-xs sm:h-9 sm:pl-9 sm:text-sm"
            aria-label="Search clubs"
          />
        </div>
        {selected.length > 0 && (
          <div className="hidden items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 lg:flex">
            <span className="text-sm font-medium">{selected.length} selected</span>
            {canDeleteClub && (
              <Button variant="destructive" size="sm" onClick={bulkDelete} disabled={bulkDeleting}>
                {bulkDeleting ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                Delete selected
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>Clear</Button>
          </div>
        )}
      </div>

      {loading ? (
        <CachedSkeleton isLoading={loading} dataLength={visibleClubs.length} />
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
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:hidden">
            {filteredClubs.map((club) => {
              const isSelected = selected.includes(club.id)
              return (
                <Item
                  key={club.id}
                  variant="outline"
                  size="sm"
                  {...longPressHandlers(club.id)}
                  onClick={() => {
                    if (selectionMode) toggleOne(club.id)
                  }}
                  className={cn(
                    "relative gap-2.5 py-1.5",
                    isSelected && "border-primary ring-2 ring-primary",
                  )}
                >
                  {selectionMode && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2">
                      <SelectionCheck checked={isSelected} />
                    </span>
                  )}
                  <ItemMedia className="size-9 shrink-0 rounded-lg bg-primary/10 text-[11px] font-black text-primary">
                    {club.shortName || club.name.slice(0, 2).toUpperCase()}
                  </ItemMedia>
                  <ItemContent className="min-w-0">
                    <ItemTitle className="truncate text-[13px] leading-tight">{club.name}</ItemTitle>
                    <ItemDescription className="flex items-center gap-1 truncate text-[11px]">
                      <MapPin className="size-3 shrink-0" />
                      {club.city || "City not set"}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions className="gap-0.5">
                    {sessionLoading ? (
                      <Button variant="ghost" size="icon-sm" disabled aria-hidden="true">
                        <Pencil className="opacity-0" />
                      </Button>
                    ) : canEditClub(club) && (
                      <Button variant="ghost" size="icon-sm" onClick={() => startEditing(club)} aria-label={`Edit ${club.name}`}>
                        <Pencil />
                      </Button>
                    )}
                    {sessionLoading ? (
                      <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" disabled aria-hidden="true">
                        <Trash2 className="opacity-0" />
                      </Button>
                    ) : canDeleteClub && (
                      <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => deleteClub(club)} disabled={deletingId === club.id} aria-label={`Delete ${club.name}`}>
                        {deletingId === club.id ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                      </Button>
                    )}
                  </ItemActions>
                </Item>
              )
            })}
          </div>

          <Card className="hidden overflow-hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  {canDeleteClub && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Select all clubs on this page"
                      />
                    </TableHead>
                  )}
                  <TableHead>Club</TableHead>
                  <TableHead>Short name</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleClubs.map((club) => (
                  <TableRow key={club.id} data-state={selected.includes(club.id) ? "selected" : undefined}>
                    {canDeleteClub && (
                      <TableCell>
                        <Checkbox
                          checked={selected.includes(club.id)}
                          onCheckedChange={() => toggleOne(club.id)}
                          aria-label={`Select ${club.name}`}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-semibold">{club.name}</TableCell>
                    <TableCell>{club.shortName || "—"}</TableCell>
                    <TableCell>{club.city || "—"}</TableCell>
                    <TableCell className="text-right"><Badge variant="secondary">Active</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {sessionLoading ? (
                          <Button variant="outline" size="sm" className="invisible" disabled aria-hidden="true">
                            <Pencil />Edit
                          </Button>
                        ) : canEditClub(club) && (
                          <Button variant="outline" size="sm" onClick={() => startEditing(club)} aria-label={`Edit ${club.name}`}>
                            <Pencil />Edit
                          </Button>
                        )}
                        {sessionLoading ? (
                          <Button variant="destructive" size="sm" className="invisible" disabled aria-hidden="true">
                            <Trash2 />Delete
                          </Button>
                        ) : canDeleteClub && (
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
            <TablePagination
              page={currentPage}
              pageCount={pageCount}
              pageSize={pageSize}
              total={filteredClubs.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
              label="clubs"
            />
          </Card>
        </>
      )}
      <SelectionBar
        count={selected.length}
        onClear={() => {
          setSelected([])
          setSelectionMode(false)
        }}
        actions={
          canDeleteClub ? (
            <Button variant="destructive" size="sm" onClick={bulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
              Delete
            </Button>
          ) : undefined
        }
      />
    </div>
  )
}
