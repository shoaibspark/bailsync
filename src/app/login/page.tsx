"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import toast from "react-hot-toast"
import { ArrowRight, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { apiJson } from "@/lib/api-client"
import { useAppDispatch } from "@/lib/store"
import { sessionReceived, writeStoredSession, type SessionUser } from "@/lib/session-slice"

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
})

export default function LoginPage() {
  const dispatch = useAppDispatch()
  const [submitting, setSubmitting] = useState(false)
  const [callbackUrl, setCallbackUrl] = useState("/matches")
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  })

  useEffect(() => {
    const callback = new URLSearchParams(window.location.search).get("callbackUrl")
    if (callback?.startsWith("/") && !callback.startsWith("//")) setCallbackUrl(callback)
  }, [])

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setSubmitting(true)
    try {
      await apiJson("/api/auth/login", { method: "POST", body: values })
      const payload = await apiJson<{ user?: SessionUser | null }>("/api/auth/session")
      const user = payload?.user ?? null
      if (user) {
        dispatch(sessionReceived(user))
        writeStoredSession(user)
      }
      window.location.assign(callbackUrl)
    } catch (cause: any) {
      toast.error(cause.message ?? "Unable to sign in")
      setSubmitting(false)
    }
  }

  const useDemo = () => {
    form.setValue("email", "admin@bailsync.local")
    form.setValue("password", "bailsync123")
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full overflow-hidden rounded-3xl border bg-card shadow-lg lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative hidden overflow-hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-24 -top-20 size-72 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <ShieldCheck className="size-6" />
            </div>
            <h1 className="mt-8 text-4xl font-black leading-tight">Welcome back to the scorers’ room.</h1>
            <p className="mt-4 max-w-md text-primary-foreground/75">Run the match, manage your club, and keep every delivery accounted for.</p>
          </div>
          <div className="relative rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
            <p className="text-sm font-semibold">Built for match day</p>
            <p className="mt-1 text-sm text-primary-foreground/70">Fast controls, resilient offline capture, and live updates for spectators.</p>
          </div>
        </div>

        <div className="p-6 sm:p-9 lg:p-12">
          <Card className="border-0 shadow-none">
            <CardHeader className="px-0 pt-0">
              <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary lg:hidden">
                <LockKeyhole />
              </div>
              <CardTitle className="text-2xl">Sign in to Bailsync</CardTitle>
              <CardDescription>Use your club account to manage teams and score matches.</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input id="email" type="email" autoComplete="email" inputMode="email" placeholder="you@club.com" aria-invalid={Boolean(form.formState.errors.email)} {...form.register("email")} />
                  {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <span className="text-xs text-muted-foreground">Minimum 1 character</span>
                  </div>
                  <Input id="password" type="password" autoComplete="current-password" placeholder="Enter your password" aria-invalid={Boolean(form.formState.errors.password)} {...form.register("password")} />
                  {form.formState.errors.password && <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>}
                </div>
                <Button type="submit" className="h-11 w-full" disabled={submitting}>
                  {submitting ? <LoaderCircle className="animate-spin" /> : null}
                  {submitting ? "Signing in…" : "Sign in"}
                </Button>
              </form>

              {process.env.NODE_ENV === "development" && (
                <button type="button" onClick={useDemo} className="mt-4 w-full rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-left text-sm transition-colors hover:bg-muted">
                  <span className="font-semibold">Use local demo account</span>
                  <span className="mt-1 block text-xs text-muted-foreground">admin@bailsync.local · bailsync123</span>
                </button>
              )}
            </CardContent>
            <CardFooter className="justify-center px-0 pb-0">
              <p className="text-sm text-muted-foreground">
                New to Bailsync?{" "}
                <Link href="/register" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                  Create an account <ArrowRight className="size-3.5" />
                </Link>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
