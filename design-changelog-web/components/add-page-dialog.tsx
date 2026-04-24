"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import type { PageCategory, ResolvedFigmaPage } from "@/lib/types"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

const CATEGORY_OPTIONS: Array<{ value: PageCategory; label: string }> = [
  { value: "coach-app", label: "Coach app" },
  { value: "client-app", label: "Client app" },
  { value: "web", label: "Web" },
]

function isProbablyFigmaUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.hostname === "www.figma.com" || parsed.hostname === "figma.com"
  } catch {
    return false
  }
}

async function fetchResolve(url: string, signal?: AbortSignal) {
  const response = await fetch("/api/pages/resolve", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
    signal,
  })

  const payload = (await response.json().catch(() => null)) as
    | { ok: true; resolved: ResolvedFigmaPage }
    | { ok: false; error?: string }
    | null

  if (!response.ok || !payload || !("ok" in payload) || !payload.ok) {
    throw new Error(payload && "error" in payload && payload.error ? payload.error : "Unable to resolve the Figma link.")
  }

  return payload.resolved
}

export function AddPageDialog() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [url, setUrl] = React.useState("")
  const [pageName, setPageName] = React.useState("")
  const [resolved, setResolved] = React.useState<ResolvedFigmaPage | null>(null)
  const [categories, setCategories] = React.useState<PageCategory[]>(["web"])
  const [isResolving, setIsResolving] = React.useState(false)
  const [resolveError, setResolveError] = React.useState<string | null>(null)
  const [resolveWarning, setResolveWarning] = React.useState<string | null>(null)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      return
    }

    setUrl("")
    setPageName("")
    setResolved(null)
    setCategories(["web"])
    setIsResolving(false)
    setResolveError(null)
    setResolveWarning(null)
    setSubmitError(null)
  }

  React.useEffect(() => {
    if (!open) {
      return
    }

    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      return
    }

    if (!isProbablyFigmaUrl(trimmedUrl)) {
      return
    }

    let active = true
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setIsResolving(true)
      setResolveError(null)
      setResolveWarning(null)
      try {
        const value = await fetchResolve(url.trim(), controller.signal)
        if (!active) {
          return
        }
        setResolved(value)
        setPageName(value.pageName)
      } catch (error) {
        if (!active) {
          return
        }
        setResolved(null)
        setPageName("Untitled") // Fallback only on error/timeout
        const message = error instanceof Error ? error.message : "Unable to resolve the Figma link."
        if (/timeout|aborted/i.test(message)) {
          setResolveWarning("Metadata is taking longer than usual. Page will be added as 'Untitled' and updated during sync.")
        } else {
          setResolveError(message)
        }
      } finally {
        if (active) {
          setIsResolving(false)
        }
      }
    }, 350)

    return () => {
      active = false
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [open, url])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)
    setIsSaving(true)

    try {
      if (!pageName.trim()) {
        throw new Error("Page name is required.")
      }

      const response = await fetch("/api/pages/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: url.trim(),
          pageName: pageName.trim(),
          categories,
        }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { ok: true }
        | { ok: false; error?: string }
        | null

      if (!response.ok || !payload || !("ok" in payload) || !payload.ok) {
        throw new Error(payload && "error" in payload && payload.error ? payload.error : "Unable to add the page.")
      }

      setOpen(false)
      setUrl("")
      setPageName("")
      setResolved(null)
      setCategories(["web"])
      router.refresh()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to add the page.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2" variant="default" size="sm">
          <PlusIcon className="size-4" />
          Add Page
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add tracked page</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="figma-url">Figma URL</Label>
            <div className="relative">
              <Input
                id="figma-url"
                placeholder="https://www.figma.com/design/..."
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value)
                  setResolved(null)
                  setResolveError(null)
                  setResolveWarning(null)
                  setPageName("")
                }}
                className={cn(isResolving && "pb-2")}
              />
              {isResolving && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden rounded-b-md">
                  <div className="h-full w-full bg-primary/30">
                    <div className="h-full w-full bg-primary animate-indeterminate-progress origin-left" />
                  </div>
                </div>
              )}
            </div>
            <style jsx global>{`
              @keyframes indeterminate-progress {
                0% { transform: translateX(-100%) scaleX(0.2); }
                50% { transform: translateX(-20%) scaleX(0.5); }
                100% { transform: translateX(100%) scaleX(0.2); }
              }
              .animate-indeterminate-progress {
                animation: indeterminate-progress 1.5s infinite linear;
              }
            `}</style>
            <div className={cn(
              "text-xs",
              resolveError ? "text-destructive" : "text-muted-foreground",
            )}>
              {isResolving
                ? "Resolving Figma metadata..."
                : resolveError ?? resolveWarning ?? "Paste the exact page canvas link from Figma."}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="page-name">Page name</Label>
            <Input
              id="page-name"
              placeholder="Auto-filling page name..."
              value={pageName}
              readOnly
              className="bg-muted/50 cursor-not-allowed focus-visible:ring-0"
            />
            <div className="text-xs text-muted-foreground">
              This will auto-fill from Figma. If resolution is slow, it will default to "Untitled".
            </div>
          </div>

          {resolved ? (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-border bg-background text-foreground">
                  Resolved
                </Badge>
                <Badge variant="outline" className="border-border bg-background text-foreground">
                  {resolved.folderSlug}
                </Badge>
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-muted-foreground">Folder</div>
                  <div className="font-medium text-foreground">{resolved.folderName}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Page</div>
                  <div className="font-medium text-foreground">{resolved.pageName}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">File key</div>
                  <div className="font-mono text-xs text-foreground">{resolved.figmaFileKey}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Page id</div>
                  <div className="font-mono text-xs text-foreground">{resolved.figmaPageId}</div>
                </div>
              </div>
            </div>
          ) : null}

          <Separator />

          <div className="space-y-3">
            <div className="text-sm font-medium text-foreground">Categories</div>
            <div className="grid gap-2 sm:grid-cols-3">
              {CATEGORY_OPTIONS.map((option) => {
                const checked = categories.includes(option.value)
                return (
                  <label
                    key={option.value}
                    htmlFor={`category-${option.value}`}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background px-4 py-3 transition-colors hover:border-foreground/40 hover:bg-muted/20",
                      checked && "border-foreground/30 bg-muted/30",
                    )}
                  >
                    <Checkbox
                      id={`category-${option.value}`}
                      checked={checked}
                      onCheckedChange={(nextChecked) => {
                        setCategories((current) => {
                          if (nextChecked) {
                            return current.includes(option.value) ? current : [...current, option.value]
                          }
                          const nextCategories = current.filter((category) => category !== option.value)
                          return nextCategories.length > 0 ? nextCategories : ["web"]
                        })
                      }}
                      className="mt-0.5 shrink-0"
                    />
                    <span className="flex-1">
                      <span className="block text-sm font-medium text-foreground">
                        {option.label}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          {submitError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {submitError}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!url.trim() || !pageName.trim() || isSaving || isResolving}
            >
              {isSaving ? "Saving..." : "Add page"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
