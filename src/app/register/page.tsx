"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import toast from "react-hot-toast"
import { ArrowRight, LoaderCircle, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { apiJson } from "@/lib/api-client"
import { useAppDispatch } from "@/lib/store"
import { sessionReceived, writeStoredSession, type SessionUser } from "@/lib/session-slice"

const schema = z.object({
  name: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Use at least 6 characters"),
  confirmPassword: z.string(),
}).refine((values) => values.password === values.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

export default function RegisterPage() {
  const dispatch = useAppDispatch()
  const [submitting, setSubmitting] = useState(false)
  const [callbackUrl, setCallbackUrl] = useState("/matches")
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  })

  useEffect(() => {
    const callback = new URLSearchParams(window.location.search).get("callbackUrl")
    if (callback?.startsWith("/") && !callback.startsWith("//")) setCallbackUrl(callback)
  }, [])

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setSubmitting(true)
    try {
      await apiJson("/api/auth/register", {
        method: "POST",
        body: { name: values.name, email: values.email, password: values.password },
      })
      const payload = await apiJson<{ user?: SessionUser | null }>("/api/auth/session")
      const user = payload?.user ?? null
      if (user) {
        dispatch(sessionReceived(user))
        writeStoredSession(user)
      }
      window.location.assign(callbackUrl)
    } catch (cause: any) {
      toast.error(cause.message ?? "Unable to create your account")
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl items-center px-4 py-10 sm:px-6">
      <Card className="mx-auto w-full max-w-xl shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <UserPlus />
          </div>
          <CardTitle className="mt-2 text-2xl">Create your account</CardTitle>
          <CardDescription>Join your club workspace in less than a minute.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" autoComplete="name" placeholder="Alex Morgan" aria-invalid={Boolean(form.formState.errors.name)} {...form.register("name")} />
              {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email address</Label>
              <Input id="email" type="email" autoComplete="email" inputMode="email" placeholder="you@club.com" aria-invalid={Boolean(form.formState.errors.email)} {...form.register("email")} />
              {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" autoComplete="new-password" placeholder="At least 6 characters" aria-invalid={Boolean(form.formState.errors.password)} {...form.register("password")} />
                {form.formState.errors.password && <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input id="confirmPassword" type="password" autoComplete="new-password" placeholder="Repeat your password" aria-invalid={Boolean(form.formState.errors.confirmPassword)} {...form.register("confirmPassword")} />
                {form.formState.errors.confirmPassword && <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>}
              </div>
            </div>
            <Button type="submit" className="h-11 w-full" disabled={submitting}>
              {submitting ? <LoaderCircle className="animate-spin" /> : null}
              {submitting ? "Creating account…" : "Create account"}
            </Button>
          </form>
          <div className="mt-5 rounded-lg border bg-muted/40 p-3 text-center text-xs text-muted-foreground">
            The first account in a workspace becomes its administrator. Later accounts start with spectator access until an administrator updates their role.
          </div>
        </CardContent>
        <CardFooter className="justify-center border-t pt-6">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
              Sign in <ArrowRight className="size-3.5" />
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
