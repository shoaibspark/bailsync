"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Building2, LoaderCircle, MapPin, Plus, UsersRound, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { apiJson } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"

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
  const { session } = useSession()
  const canManage = session?.role === "ADMIN" || session?.role === "SCORER"
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
        <Button onClick={() => setOpen((current) => !current)} disabled={!canManage}>
          {open ? <X /> : <Plus />}
          {open ? "Close" : "Add club"}
        </Button>
      </div>

      {!canManage && !loading && (
        <Alert className="mb-5">
          <AlertTitle>View-only access</AlertTitle>
          <AlertDescription>Ask an administrator to change your role before creating clubs.</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertTitle>Club action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {open && canManage && (
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {clubs.map((club) => (
                  <TableRow key={club.id}>
                    <TableCell className="font-semibold">{club.name}</TableCell>
                    <TableCell>{club.shortName || "—"}</TableCell>
                    <TableCell>{club.city || "—"}</TableCell>
                    <TableCell className="text-right"><Badge variant="secondary">Active</Badge></TableCell>
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
