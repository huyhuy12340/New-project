"use client"

import * as React from "react"
import Link from "next/link"
import { SearchIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { FigmaIcon } from "@/components/figma-icon"
import { cn } from "@/lib/utils"
import type { TrackedPage } from "@/lib/types"

const CATEGORY_LABELS = {
  "coach-app": "Coach app",
  "client-app": "Client app",
  web: "Web",
} as const

type SearchPaletteProps = {
  pages: TrackedPage[]
}

function matchesQuery(page: TrackedPage, query: string) {
  const haystack = [
    page.pageName,
    page.folderName,
    page.figmaPageName ?? "",
    page.figmaFileName,
    ...page.categories,
  ]
    .join(" ")
    .toLowerCase()

  return haystack.includes(query.toLowerCase())
}

export function SearchPalette({ pages }: SearchPaletteProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen(true)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const results = query.trim()
    ? pages.filter((page) => matchesQuery(page, query)).slice(0, 12)
    : pages.slice(0, 12)

  return (
    <>
      {/* Floating glassmorphism search bar - Bottom Center */}
      <div 
        className={cn(
          "fixed bottom-8 left-1/2 z-40 -translate-x-1/2 transition-all duration-500 ease-in-out",
          open ? "pointer-events-none translate-y-4 opacity-0" : "opacity-100"
        )}
      >
        <button
          onClick={() => setOpen(true)}
          className="group flex cursor-pointer items-center gap-3 rounded-full border border-white/20 bg-white/10 px-6 py-3 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1),0_20px_25px_-5px_rgba(0,0,0,0.04)] backdrop-blur-[12px] transition-all duration-300 hover:scale-105 hover:border-white/40 hover:bg-white/20 dark:border-white/10 dark:bg-black/40"
          aria-label="Search pages"
        >
          <SearchIcon className="size-4 text-foreground/70" />
          <span className="text-sm font-medium text-foreground/60 select-none min-w-[120px] text-left">
            Search pages...
          </span>
          <kbd className="ml-2 flex items-center gap-1 rounded-md border border-foreground/20 bg-foreground/10 px-2 py-1 text-[10px] font-bold text-foreground/60 shadow-sm">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>
      </div>

      {/* Search dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery("") }}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Search pages</DialogTitle>
            <DialogDescription>Search tracked pages by name, folder, or category.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              autoFocus
              placeholder="Search pages..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="space-y-2">
              {results.length > 0 ? (
                results.map((page) => (
                  <Link
                    key={page.id}
                    href={`/${page.folderSlug}/${page.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3 transition-colors hover:border-foreground/30 hover:bg-muted/20"
                    onClick={() => { setOpen(false); setQuery("") }}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">{page.pageName}</div>
                      <div className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                        <FigmaIcon className="size-3 shrink-0" />
                        <span>{page.folderName}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {page.categories.map((category) => (
                        <Badge key={category} variant="outline" className="border-border bg-muted/60 text-foreground">
                          {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category}
                        </Badge>
                      ))}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-background px-4 py-6 text-sm text-muted-foreground">
                  No pages matched this search.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
