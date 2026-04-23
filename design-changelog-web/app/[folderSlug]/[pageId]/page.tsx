import Link from "next/link"
import { notFound } from "next/navigation"
import { Clock, ArrowUpRight, Layers } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FramePreview } from "@/components/FramePreview"
import { FrameCompareDialog } from "@/components/FrameCompareDialog"
import { getSectionHistory, getFramesBySection } from "@/lib/diff-parser"
import { loadIndex } from "@/lib/github"
import { findPageById } from "@/lib/catalog"

type PageProps = {
  params: Promise<{ folderSlug: string; pageId: string }>
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  added: { label: "New", className: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800" },
  edited: { label: "Updated", className: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800" },
  removed: { label: "Removed", className: "bg-red-500/10 text-red-500 border-red-200 dark:border-red-800" },
}

function buildProxyUrl(rawUrl: string, fileKey: string, nodeId: string) {
  return `/api/proxy-image?${new URLSearchParams({ url: rawUrl, fileKey, nodeId })}`
}

function timeAgo(isoDate: string) {
  const diff = Date.now() - new Date(isoDate).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(diff / 86_400_000)
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

export default async function PageHistoryPage({ params }: PageProps) {
  const { folderSlug, pageId } = await params
  const [index, page] = await Promise.all([loadIndex(), findPageById(pageId)])

  if (!page || page.folderSlug !== folderSlug) notFound()

  // Get latest entry for this page
  const history = getSectionHistory(index, pageId)
  const latestEntry = history[0]

  const sectionGroups = latestEntry ? getFramesBySection(latestEntry.frames) : []
  const hasData = sectionGroups.length > 0

  return (
    <main className="flex w-full flex-col gap-10 px-16 pt-5 pb-12">
      <PageHeader
        crumbs={[
          { label: "Home", href: "/" },
          { label: page.folderName, href: `/${folderSlug}` },
          { label: page.pageName },
        ]}
        title={page.pageName}
        description={page.figmaFileName}
        figmaUrl={page.figmaUrl}
      />

      {!hasData ? (
        /* ── Empty state ── */
        <div className="rounded-xl border border-dashed border-border bg-background px-6 py-16 text-center">
          <Layers className="mx-auto mb-3 size-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No changes captured yet</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Click &quot;Sync now&quot; to scan your Figma file for sections and frames.
          </p>
        </div>
      ) : (
        /* ── Section groups ── */
        <div className="flex flex-col gap-10">
          {sectionGroups.map(({ sectionId, sectionName, frames, hasChanges }) => (
            <div key={sectionId} className="flex flex-col gap-4">
              {/* Section header */}
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-foreground">{sectionName}</h2>
                {hasChanges && (
                  <Badge variant="outline" className="text-[10px] px-2 py-0 bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800">
                    Changed
                  </Badge>
                )}
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">{frames.length} frame{frames.length !== 1 ? "s" : ""}</span>
              </div>

              {/* Frame cards grid (Gap 16px) */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {frames.map((frame) => {
                  const badge = frame.status !== "pending" ? STATUS_BADGE[frame.status] : null
                  const thumbnailUrl = frame.thumbnail
                    ? buildProxyUrl(frame.thumbnail, page.figmaFileKey, frame.id)
                    : null

                  return (
                    <div
                      key={frame.id}
                      className={`group flex flex-col overflow-hidden bg-background transition-all ${frame.status === "edited" ? "bg-blue-50/50 dark:bg-blue-900/10" :
                          frame.status === "added" ? "bg-emerald-50/50 dark:bg-emerald-900/10" :
                            frame.status === "removed" ? "bg-red-50/50 dark:bg-red-900/10 opacity-60" :
                              ""
                        }`}
                    >
                      {/* Canvas preview (Aspect Ratio 5:7) with Compare Dialog */}
                      <FrameCompareDialog 
                        frameId={frame.id} 
                        currentFrameName={frame.name} 
                        allEntries={index.entries}
                      >
                        <div className="cursor-pointer block w-full">
                          {thumbnailUrl ? (
                            <FramePreview
                              src={thumbnailUrl}
                              alt={frame.name}
                              className="aspect-[5/7] w-full rounded-3xl"
                            />
                          ) : (
                            <div className="flex aspect-[5/7] items-center justify-center rounded-3xl bg-muted/20 text-muted-foreground">
                              <div className="flex flex-col items-center gap-1.5 text-center">
                                <Layers className="size-6 opacity-30" />
                                <p className="text-[10px] opacity-50">No screenshot yet</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </FrameCompareDialog>

                      {/* Card footer (No horizontal padding) */}
                      <div className="flex items-center justify-between gap-2 py-3 pl-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {badge && (
                              <Badge variant="outline" className={`shrink-0 text-[9px] px-1.5 py-0 font-medium ${badge.className}`}>
                                {badge.label}
                              </Badge>
                            )}
                            <span className="truncate text-sm font-medium text-foreground">{frame.name}</span>
                          </div>
                          <p 
                            className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground"
                            suppressHydrationWarning
                          >
                            <Clock className="size-2.5" />
                            {timeAgo(latestEntry.lastDetectedAt)}
                          </p>
                        </div>

                        <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs" asChild>
                          <a 
                            href={`https://www.figma.com/design/${page.figmaFileKey}?node-id=${frame.id}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <ArrowUpRight className="size-3.5" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
