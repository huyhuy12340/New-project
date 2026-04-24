import Link from "next/link"
import { notFound } from "next/navigation"
import { Clock, ArrowUpRight, Layers } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FrameCompareDialog } from "@/components/FrameCompareDialog"
import { getSectionHistory, getFramesBySection } from "@/lib/diff-parser"
import { loadIndex } from "@/lib/github"
import { findPageById } from "@/lib/catalog"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { readUserState } from "@/lib/data-store"
import { getPersonalizedFrameChanges } from "@/lib/figma-sync"
import type { FrameChange } from "@/lib/types"

type PageProps = {
  params: Promise<{ folderSlug: string; pageId: string }>
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  added:   { label: "New",     className: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800" },
  edited:  { label: "Updated", className: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800" },
  removed: { label: "Removed", className: "bg-red-500/10 text-red-500 border-red-200 dark:border-red-800" },
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

  const session = await getServerSession(authOptions)
  const userId = session?.user?.email // Using email as ID for simplicity

  const history = getSectionHistory(index, pageId)
  const latestEntry = history[0]

  // --- Personalized Diffing Logic ---
  let frames: FrameChange[] = []
  let lastSeenVersionId: string | null = null

  if (userId && latestEntry) {
    const userState = await readUserState(userId)
    lastSeenVersionId = userState?.pageStates[pageId]?.lastSeenVersionId || null
    
    // Calculate changes relative to what THIS user saw last
    frames = await getPersonalizedFrameChanges(
      pageId, 
      lastSeenVersionId, 
      latestEntry.versionId || ""
    )
  } else if (latestEntry) {
    // Fallback to global if no session (shouldn't happen with middleware)
    frames = latestEntry.frames
  }

  // Regroup frames by section for the UI
  const sectionGroups: any[] = []
  const sectionsMap: Record<string, { sectionId: string; sectionName: string; frames: FrameChange[]; hasChanges: boolean }> = {}

  frames.forEach(f => {
    const sId = f.sectionId || "other"
    if (!sectionsMap[sId]) {
      sectionsMap[sId] = { sectionId: sId, sectionName: f.sectionName || "Other", frames: [], hasChanges: false }
      sectionGroups.push(sectionsMap[sId])
    }
    sectionsMap[sId].frames.push(f)
    if (f.status !== "pending") sectionsMap[sId].hasChanges = true
  })

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
        pageId={page.id}
        description={page.figmaFileName}
        figmaUrl={page.figmaUrl}
        latestVersionId={latestEntry?.versionId}
      />

      {!hasData ? (
        <div className="rounded-xl border border-dashed border-border bg-background px-6 py-16 text-center">
          <Layers className="mx-auto mb-3 size-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No changes captured yet</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Click &quot;Sync now&quot; to scan your Figma file for sections and frames.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {sectionGroups.map(({ sectionId, sectionName, frames, hasChanges }) => (
            <div key={sectionId} className="flex flex-col gap-3">
              {/* Section header */}
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-foreground">{sectionName}</h2>
                {hasChanges && (
                  <Badge variant="outline" className="text-[10px] px-2 py-0 bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800">
                    Changed
                  </Badge>
                )}
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">
                  {frames.length} frame{frames.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Responsive Grid with min-max sizing */}
              <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
                {frames.map((frame: FrameChange) => {
                  const badge = frame.status !== "pending" ? STATUS_BADGE[frame.status] : null
                  const changedLayers = frame.layers.filter((l: any) => l.status !== "pending")

                  return (
                    <div key={frame.id} className="relative group">
                      <FrameCompareDialog
                        frame={frame}
                        figmaFileKey={page.figmaFileKey}
                        version={latestEntry?.versionId}
                        figmaUrl={`https://www.figma.com/design/${page.figmaFileKey}?node-id=${frame.id}`}
                      >
                        <div className={`h-full flex flex-col justify-between p-3 rounded-xl border transition-all cursor-pointer bg-background hover:shadow-md hover:border-blue-200 ${
                          frame.status === "removed" ? "opacity-60 grayscale" : ""
                        }`}>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              {/* Status indicator dot */}
                              <div className={`size-1.5 rounded-full shrink-0 ${
                                frame.status === "added"   ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" :
                                frame.status === "edited"  ? "bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]" :
                                frame.status === "removed" ? "bg-red-400" :
                                "bg-muted-foreground/20"
                              }`} />

                              {badge && (
                                <Badge
                                  variant="outline"
                                  className={`shrink-0 text-[8px] px-1 py-0 font-bold uppercase border-none ${badge.className}`}
                                >
                                  {badge.label}
                                </Badge>
                              )}
                            </div>

                            <h3 className="text-[13px] font-bold text-foreground leading-snug line-clamp-2">
                              {frame.name}
                            </h3>
                          </div>

                          <div className="mt-4 pt-2 border-t border-border/40 flex items-center justify-between">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[9px] font-bold text-muted-foreground flex items-center gap-1">
                                <Layers className="size-2" />
                                {changedLayers.length} {changedLayers.length === 1 ? "change" : "changes"}
                              </span>
                              <span
                                className="text-[8px] font-medium text-muted-foreground/50 flex items-center gap-1"
                                suppressHydrationWarning
                              >
                                <Clock className="size-2" />
                                {timeAgo(latestEntry.lastDetectedAt)}
                              </span>
                            </div>
                            
                            <div className="w-6 h-6" />
                          </div>
                        </div>
                      </FrameCompareDialog>

                      <a
                        href={`https://www.figma.com/design/${page.figmaFileKey}?node-id=${frame.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute bottom-3 right-3 size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-all opacity-0 group-hover:opacity-100 z-10"
                        title="Open in Figma"
                      >
                        <ArrowUpRight className="size-3.5" />
                      </a>
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
