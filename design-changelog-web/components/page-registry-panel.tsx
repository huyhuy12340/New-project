"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { MoreHorizontalIcon, Trash2Icon } from "lucide-react"

import { AddPageDialog } from "@/components/add-page-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { formatDateTimeLabel } from "@/lib/date"
import type { PageCategory, TrackedPage } from "@/lib/types"

type PageRegistryPanelProps = {
  pages: TrackedPage[]
}

const CATEGORY_LABELS: Record<PageCategory, string> = {
  "coach-app": "Coach app",
  "client-app": "Client app",
  web: "Web",
}

const CATEGORY_ORDER: PageCategory[] = ["coach-app", "client-app", "web"]

function groupPagesByFolderLocal(pages: TrackedPage[]) {
  const groups = new Map<string, TrackedPage[]>()
  for (const page of pages) {
    const current = groups.get(page.folderSlug) ?? []
    current.push(page)
    groups.set(page.folderSlug, current)
  }

  return [...groups.entries()].map(([folderSlug, groupedPages]) => ({
    folderSlug,
    folderName: groupedPages[0]?.folderName ?? folderSlug,
    pages: groupedPages.sort((left, right) => left.pageName.localeCompare(right.pageName)),
  }))
}

function summarizeFolderTags(folderPages: TrackedPage[]) {
  const categories = [...new Set(folderPages.flatMap((page) => page.categories))]
  return categories.sort((left, right) => CATEGORY_ORDER.indexOf(left) - CATEGORY_ORDER.indexOf(right))
}

function FolderAccordionItem({ folder }: { folder: ReturnType<typeof groupPagesByFolderLocal>[number] }) {
  const categories = summarizeFolderTags(folder.pages)

  return (
    <AccordionItem
      key={folder.folderSlug}
      value={folder.folderSlug}
      className="rounded-lg border border-border px-4"
    >
      <AccordionTrigger className="py-4 hover:no-underline">
        <div className="flex w-full items-center justify-between gap-3 pr-3 text-left">
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">{folder.folderName}</div>
            <div className="text-sm text-muted-foreground">
              {folder.pages.length} tracked page{folder.pages.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {categories.map((category) => (
              <Badge
                key={category}
                variant="outline"
                className="border-border bg-background text-foreground"
              >
                {CATEGORY_LABELS[category] ?? category}
              </Badge>
            ))}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-4">
        <div className="space-y-3 pt-2">
          {folder.pages.map((page) => (
            <PageRow key={page.id} page={page} />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

function PageRow({ page }: { page: TrackedPage }) {
  const router = useRouter()
  const [isRemoving, setIsRemoving] = React.useState(false)

  async function handleRemove() {
    setIsRemoving(true)
    try {
      const response = await fetch("/api/pages/remove", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pageId: page.id }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { ok: true }
        | { ok: false; error?: string }
        | null

      if (!response.ok || !payload || !("ok" in payload) || !payload.ok) {
        throw new Error(payload && "error" in payload && payload.error ? payload.error : "Unable to remove the page.")
      }

      router.refresh()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to remove the page.")
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <Link
          className="truncate font-medium text-foreground transition-colors hover:text-primary"
          href={`/${page.folderSlug}/${page.id}`}
        >
          {page.pageName}
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <div className="text-right text-sm text-muted-foreground">
          {formatDateTimeLabel(page.addedAt)}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              disabled={isRemoving}
              onSelect={(event) => {
                event.preventDefault()
                void handleRemove()
              }}
            >
              <Trash2Icon className="size-4" />
              {isRemoving ? "Removing..." : "Remove page"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export function PageRegistryPanel({ pages }: PageRegistryPanelProps) {
  const folders = groupPagesByFolderLocal(pages)

  if (pages.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-background p-6">
        <div className="flex flex-col items-start gap-4">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">Start your registry</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Add the first Figma page URL and Design Changelog will create the page registry,
              folder grouping, and daily polling target automatically.
            </p>
          </div>
          <AddPageDialog />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-background">
      <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight">Tracked pages</h2>
          <p className="text-sm text-muted-foreground">
            Grouped by Figma file. Add or remove pages from the registry here.
          </p>
        </div>
        <AddPageDialog />
      </div>

      <div className="p-4">
        <Accordion type="multiple" className="w-full space-y-3">
          {folders.map((folder) => (
            <FolderAccordionItem key={folder.folderSlug} folder={folder} />
          ))}
        </Accordion>
      </div>

      <Separator />
      <div className="px-4 py-3 text-xs text-muted-foreground">
        {pages.length} tracked page{pages.length === 1 ? "" : "s"} in {folders.length} folder
        group{folders.length === 1 ? "" : "s"}.
      </div>
    </div>
  )
}
