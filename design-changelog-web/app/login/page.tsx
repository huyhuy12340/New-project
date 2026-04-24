"use client"

import { Layers } from "lucide-react"
import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 px-4 py-12">
      <div className="w-full max-w-[400px] space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-zinc-200/50">
            <Layers className="size-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Design Changelog</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to track your personal design history
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
