"use client"

import { useCallback, useMemo, useState, useEffect } from "react"
import toast from "react-hot-toast"
import { LoaderCircle, Search, ShieldCheck, UsersRound, Pencil, Save } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { MultiSelectCombobox } from "@/components/multi-select"
import { TablePagination } from "@/components/table-pagination"
import { apiJson } from "@/lib/api-client"
import { useCachedData } from "@/hooks/use-cached-data"
import { useSession } from "@/hooks/use-session"
import { AppRole, isManager, isSuperadmin, ROLES, ROLE_LABELS } from "@/lib/roles"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ListSkeleton } from "@/components/list-skeleton"

type User = {
  id: string
  name: string | null
  email: string
  role: AppRole
  clubIds: string[]
  clubs: Array<{ id: string; name: string }>
  createdAt: string
}

type Club = { id: string; name: string }

const roleDetails: Record<AppRole, string> = {
  SUPERADMIN: "Unrestricted control of every club, fixture, tournament, and user",
  ADMIN: "Manages every club they are a member of, plus rosters and fixtures",
  SCORER: "Sets up matches and records deliveries",
  VIEWER: "Read-only access to public club information",
}

function useIsMobile() {
  const [mobile, setMobile] = useState<boolean>(false)
  useEffect(() => {
    if (typeof window === "undefined") return
    setMobile(window.innerWidth < 768)
    const mq = window.matchMedia("(max-width: 767px)")
    const onChange = (e: MediaQueryListEvent) => setMobile(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  return mobile
}

export default function AdminUsersPage() {
  const [updating, setUpdating] = useState("")
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const isMobile = useIsMobile()
  const { session, status } = useSession()
  const sessionLoading = status === "loading"
  const superadmin = isSuperadmin(session?.role)
  const canManage = isManager(session?.role)
  const assignableRoles: AppRole[] = superadmin ? [...ROLES] : ["SCORER", "VIEWER"]

  const usersCache = useCachedData<User[]>("users:admin", () => apiJson<User[]>("/api/admin/users"), {
    enabled: !sessionLoading,
  })
  const clubsCache = useCachedData<Club[]>("clubs:list", () => apiJson<Club[]>("/api/clubs"), {
    enabled: !sessionLoading,
  })

  const users = usersCache.data ?? []
  const clubs = clubsCache.data ?? []
  const clubOptions = useMemo(() => clubs.map((club) => ({ value: club.id, label: club.name })), [clubs])

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return users
    return users.filter((user) =>
      [user.name, user.email, user.role, ...user.clubs.map((club) => club.name)]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term)),
    )
  }, [users, query])

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const openEdit = (user: User) => {
    setEditingUser(user)
  }

  const closeEdit = () => {
    setEditingUser(null)
  }

  const saveEdit = async () => {
    if (!editingUser) return
    setUpdating(editingUser.id)
    try {
      await apiJson<User>("/api/admin/users", {
        method: "PATCH",
        body: { userId: editingUser.id, role: editingUser.role, clubIds: editingUser.clubIds },
      })
      await usersCache.refresh()
      toast.success("User access updated")
      closeEdit()
    } catch (cause: any) {
      toast.error(cause.message ?? "Unable to update this user")
    } finally {
      setUpdating("")
    }
  }

  const setRole = (value: string) => {
    if (!editingUser) return
    setEditingUser((current) => (current ? { ...current, role: value as AppRole } : null))
  }

  const setClubIds = (clubIds: string[]) => {
    if (!editingUser) return
    setEditingUser((current) => (current ? { ...current, clubIds } : null))
  }

  if (status === "unauthenticated" || (status === "authenticated" && !canManage)) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <Alert variant="destructive">
          <ShieldCheck />
          <AlertTitle>Access denied</AlertTitle>
          <AlertDescription>Only admins and super admins can manage user access.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const editSurface = (user: User) => (
    <>
      <div className="grid gap-4 p-4 sm:p-6">
        <div className="grid gap-2 text-sm font-medium">
          <Label htmlFor="edit-user-role">Access role</Label>
          <Select value={user.role} onValueChange={setRole}>
            <SelectTrigger id="edit-user-role"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {assignableRoles.map((role) => (
                  <SelectItem key={role} value={role} disabled={user.id === session?.userId && role !== user.role && !superadmin}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        {superadmin && (
          <div className="grid gap-2 text-sm font-medium">
            <Label htmlFor="edit-user-clubs">Club access</Label>
            <MultiSelectCombobox
              id="edit-user-clubs"
              options={clubOptions}
              value={user.clubIds}
              onChange={setClubIds}
              placeholder="Assign clubs"
              emptyLabel="No clubs available"
              disabled={updating === user.id}
            />
          </div>
        )}
      </div>
    </>
  )

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-4 sm:mb-6">
        <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary sm:text-xs"><ShieldCheck className="size-4" /> Administration</div>
        <h1 className="text-lg font-bold tracking-tight sm:text-3xl">User access</h1>
        <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm sm:text-base">
          Super admins control the whole workspace. Club admins manage the clubs they belong to and can only assign scorer or viewer access.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ROLES.map((role) => (
          <Card key={role}><CardContent className="p-4"><div className="flex items-center justify-between"><Badge variant={role === "SUPERADMIN" ? "default" : "secondary"}>{role}</Badge><span className="text-2xl font-black">{users.filter((user) => user.role === role).length}</span></div><p className="mt-2 text-xs text-muted-foreground">{roleDetails[role]}</p></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><UsersRound />Workspace users</CardTitle>
              <CardDescription>Role changes apply the next time the user refreshes their workspace.</CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setPage(1)
                }}
                placeholder="Search users, clubs, roles"
                className="h-8 pl-8 text-xs sm:h-9 sm:pl-9 sm:text-sm"
                aria-label="Search users"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {usersCache.isLoading && !users.length ? (
            <ListSkeleton columns={5} rows={5} />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Clubs</TableHead>
                      <TableHead className="hidden md:table-cell">Joined</TableHead>
                      <TableHead className="w-48">Access role</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleUsers.map((user) => {
                      const isSelf = user.id === session?.userId
                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <p className="font-semibold">{user.name || "Unnamed user"}</p>
                            <p className="text-xs text-muted-foreground">{user.email}{isSelf ? " · You" : ""}</p>
                          </TableCell>
                          <TableCell>
                            {user.clubs.length ? (
                              <div className="flex flex-wrap gap-1">
                                {user.clubs.map((club) => (
                                  <Badge key={club.id} variant="outline">{club.name}</Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(user.createdAt))}
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.role === "SUPERADMIN" ? "default" : "outline"}>
                              {ROLE_LABELS[user.role]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(user)}
                              disabled={updating === user.id}
                              aria-label={`Edit access for ${user.email}`}
                            >
                              {updating === user.id ? <LoaderCircle className="animate-spin size-3" /> : <Pencil className="size-4" />}
                              <span className="sr-only">Edit {user.email}</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                page={currentPage}
                pageCount={pageCount}
                pageSize={pageSize}
                total={filteredUsers.length}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setPage(1)
                }}
                label="users"
              />
            </>
          )}
        </CardContent>
      </Card>

      {editingUser && (isMobile ? (
        <Sheet open>
          <SheetContent className="sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Edit {editingUser.name || "user"}</SheetTitle>
              <SheetDescription>Change the access role and club membership for {editingUser.email}.</SheetDescription>
            </SheetHeader>
            {editingUser && editSurface(editingUser)}
            <SheetFooter>
              <Button variant="outline" onClick={closeEdit} disabled={updating === editingUser.id}>
                Cancel
              </Button>
              <Button onClick={saveEdit} disabled={updating === editingUser.id}>
                {updating === editingUser.id ? <LoaderCircle className="animate-spin size-3" /> : <Save className="size-4" />}
                Save
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open modal={true}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit {editingUser.name || "user"}</DialogTitle>
              <DialogDescription>Change the access role and club membership for {editingUser.email}.</DialogDescription>
            </DialogHeader>
            {editingUser && editSurface(editingUser)}
            <DialogFooter>
              <Button variant="outline" onClick={closeEdit} disabled={updating === editingUser.id}>
                Cancel
              </Button>
              <Button onClick={saveEdit} disabled={updating === editingUser.id}>
                {updating === editingUser.id ? <LoaderCircle className="animate-spin size-3" /> : <Save className="size-4" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  )
}
