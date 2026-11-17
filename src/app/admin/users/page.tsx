"use client"

import { useMemo, useState } from "react"
import { LoaderCircle, Search, ShieldCheck, UsersRound } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { MultiSelectCombobox } from "@/components/multi-select"
import { TablePagination } from "@/components/table-pagination"
import { apiJson } from "@/lib/api-client"
import { useCachedData } from "@/hooks/use-cached-data"
import { useSession } from "@/hooks/use-session"
import { AppRole, isSuperadmin, ROLES, ROLE_LABELS } from "@/lib/roles"

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

export default function AdminUsersPage() {
  const [updating, setUpdating] = useState("")
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const { session, loading: sessionLoading } = useSession()
  const superadmin = isSuperadmin(session?.role)
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

  const updateUser = async (userId: string, changes: { role?: AppRole; clubIds?: string[] }) => {
    setUpdating(userId)
    setError("")
    try {
      const updated = await apiJson<User>("/api/admin/users", {
        method: "PATCH",
        body: { userId, ...changes },
      })
      await usersCache.refresh()
    } catch (cause: any) {
      setError(cause.message ?? "Unable to update this user")
    } finally {
      setUpdating("")
    }
  }

  if (!sessionLoading && session && !superadmin && session.role !== "ADMIN") {
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

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-4 sm:mb-6">
        <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary sm:text-xs"><ShieldCheck className="size-4" /> Administration</div>
        <h1 className="text-lg font-bold tracking-tight sm:text-3xl">User access</h1>
        <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm sm:text-base">
          Super admins control the whole workspace. Club admins manage the clubs they belong to and can only assign scorer or viewer access.
        </p>
      </div>

      {error && <Alert variant="destructive" className="mb-5"><AlertTitle>User action failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
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
            <div className="px-4 pb-6"><div className="h-64 animate-pulse rounded-xl bg-muted" /></div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Clubs</TableHead><TableHead className="hidden md:table-cell">Joined</TableHead><TableHead className="w-48">Access role</TableHead></TableRow></TableHeader>
                  <TableBody>{visibleUsers.map((user) => {
                    const isSelf = user.id === session?.userId
                    const roleLocked = isSelf && !superadmin
                    return (
                      <TableRow key={user.id}>
                        <TableCell><p className="font-semibold">{user.name || "Unnamed user"}</p><p className="text-xs text-muted-foreground">{user.email}{isSelf ? " · You" : ""}</p></TableCell>
                        <TableCell>
                          {superadmin ? (
                            <div className="w-64 max-w-full">
                              <MultiSelectCombobox
                                options={clubOptions}
                                value={user.clubIds}
                                onChange={(clubIds) => updateUser(user.id, { clubIds })}
                                placeholder="Assign clubs"
                                emptyLabel="No clubs available"
                                disabled={updating === user.id}
                              />
                            </div>
                          ) : user.clubs.length ? (
                            <div className="flex flex-wrap gap-1">
                              {user.clubs.map((club) => <Badge key={club.id} variant="outline">{club.name}</Badge>)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(user.createdAt))}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Select
                              value={user.role}
                              onValueChange={(value) => updateUser(user.id, { role: value as AppRole })}
                              disabled={updating === user.id || roleLocked}
                            >
                              <SelectTrigger className="w-full" aria-label={`Access role for ${user.email}`}><SelectValue /></SelectTrigger>
                              <SelectContent><SelectGroup>{assignableRoles.map((role) => <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>)}</SelectGroup></SelectContent>
                            </Select>
                            {updating === user.id && <LoaderCircle className="size-4 animate-spin text-muted-foreground" />}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}</TableBody>
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
    </div>
  )
}
