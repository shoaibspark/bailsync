"use client"

import { useEffect, useState } from "react"
import { LoaderCircle, ShieldCheck, UsersRound } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiJson } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { AppRole, isSuperadmin, ROLES, ROLE_LABELS } from "@/lib/roles"

type User = {
  id: string
  name: string | null
  email: string
  role: AppRole
  clubId: string | null
  club: { id: string; name: string } | null
  createdAt: string
}

type Club = { id: string; name: string }

const roleDetails: Record<AppRole, string> = {
  SUPERADMIN: "Unrestricted control of every club, fixture, tournament, and user",
  ADMIN: "Manages their own club, roster, fixtures, and club members",
  SCORER: "Sets up matches and records deliveries",
  VIEWER: "Read-only access to public club information",
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [updating, setUpdating] = useState("")
  const { session, loading: sessionLoading } = useSession()
  const superadmin = isSuperadmin(session?.role)
  const assignableRoles: AppRole[] = superadmin ? [...ROLES] : ["SCORER", "VIEWER"]

  useEffect(() => {
    let active = true
    Promise.all([apiJson<User[]>("/api/admin/users"), apiJson<Club[]>("/api/clubs")])
      .then(([userData, clubData]) => {
        if (!active) return
        setUsers(userData)
        setClubs(clubData)
      })
      .catch((cause: any) => {
        if (active) setError(cause.message ?? "Unable to load users")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const updateUser = async (userId: string, changes: { role?: AppRole; clubId?: string | null }) => {
    setUpdating(userId)
    setError("")
    try {
      const updated = await apiJson<User>("/api/admin/users", {
        method: "PATCH",
        body: { userId, ...changes },
      })
      setUsers((current) => current.map((user) => user.id === updated.id ? { ...user, role: updated.role, clubId: updated.clubId } : user))
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
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-7">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary"><ShieldCheck className="size-4" /> Administration</div>
        <h1 className="text-3xl font-bold tracking-tight">User access</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Super admins control the whole workspace. Club admins manage their own club and can only assign scorer or viewer access.
        </p>
      </div>

      {error && <Alert variant="destructive" className="mb-5"><AlertTitle>User action failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((role) => (
          <Card key={role}><CardContent className="p-4"><div className="flex items-center justify-between"><Badge variant={role === "SUPERADMIN" ? "default" : "secondary"}>{role}</Badge><span className="text-2xl font-black">{users.filter((user) => user.role === role).length}</span></div><p className="mt-2 text-xs text-muted-foreground">{roleDetails[role]}</p></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><UsersRound />Workspace users</CardTitle><CardDescription>Role changes apply the next time the user refreshes their workspace.</CardDescription></CardHeader>
        <CardContent>
          {loading ? <div className="h-64 animate-pulse rounded-xl bg-muted" /> : (
            <Table>
              <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Club</TableHead><TableHead>Joined</TableHead><TableHead className="w-48">Access role</TableHead></TableRow></TableHeader>
              <TableBody>{users.map((user) => {
                const isSelf = user.id === session?.userId
                const roleLocked = isSelf && !superadmin
                return (
                  <TableRow key={user.id}>
                    <TableCell><p className="font-semibold">{user.name || "Unnamed user"}</p><p className="text-xs text-muted-foreground">{user.email}{isSelf ? " · You" : ""}</p></TableCell>
                    <TableCell>
                      {superadmin ? (
                        <Select
                          value={user.clubId ?? "none"}
                          onValueChange={(value) => updateUser(user.id, { clubId: value === "none" ? null : value })}
                          disabled={updating === user.id}
                        >
                          <SelectTrigger className="w-full" aria-label={`Club for ${user.email}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="none">No club</SelectItem>
                              {clubs.map((club) => <SelectItem key={club.id} value={club.id}>{club.name}</SelectItem>)}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      ) : (
                        user.club?.name || "—"
                      )}
                    </TableCell>
                    <TableCell>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(user.createdAt))}</TableCell>
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
