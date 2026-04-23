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
import { cn } from "@/lib/utils"

const CATEGORY_OPTIONS: Array<{ value: PageCategory; label: string; description: string }> = [
  { value: "coach-app", label: "Coach app", description: "Internal coaching experiences." },
  { value: "client-app", label: "Client app", description: "Client-facing flows and screens." },
  { value: "web", label: "Web", description: "Web surfaces and admin tools." },
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
  const pageNameTouchedRef = React.useRef(false)
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
    pageNameTouchedRef.current = false
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
        if (!pageNameTouchedRef.current) {
          setPageName(value.pageName)
        }
      } catch (error) {
        if (!active) {
          return
        }
        setResolved(null)
        const message = error instanceof Error ? error.message : "Unable to resolve the Figma link."
        if (/timeout|aborted/i.test(message)) {
          setResolveWarning("Metadata could not be loaded yet. Enter the page name manually to continue.")
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
      pageNameTouchedRef.current = false
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
            <DialogDescription>
              Paste a Figma page URL with a `node-id`. The file name becomes the folder. The
              page name will auto-fill when metadata resolves quickly, otherwise enter it manually.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="figma-url">Figma URL</Label>
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
                pageNameTouchedRef.current = false
              }}
            />
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
              placeholder="Enter or auto-fill page name"
              value={pageName}
              onChange={(event) => {
                setPageName(event.target.value)
                pageNameTouchedRef.current = true
              }}
            />
            <div className="text-xs text-muted-foreground">
              This will auto-fill when Figma metadata resolves quickly. If not, enter it manually.
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
                    <span className="space-y-1">
                      <span className="block text-sm font-medium text-foreground">
                        {option.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {option.description}
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
              disabled={!url.trim() || !pageName.trim() || isSaving}
            >
              {isSaving ? "Saving..." : "Add page"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
