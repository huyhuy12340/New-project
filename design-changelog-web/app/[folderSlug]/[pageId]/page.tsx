import Link from "next/link"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDateLabel } from "@/lib/date"
import { getSectionHistory } from "@/lib/diff-parser"
import { loadIndex } from "@/lib/github"
import { findPageById } from "@/lib/catalog"

type PageProps = {
  params: Promise<{
    folderSlug: string
    pageId: string
  }>
}

export default async function PageHistoryPage({ params }: PageProps) {
  const { folderSlug, pageId } = await params
  const [index, page] = await Promise.all([loadIndex(), findPageById(pageId)])
  const history = getSectionHistory(index, pageId)

  if (!page || page.folderSlug !== folderSlug) {
    notFound()
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
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

      <div className="space-y-4">
        {history.length > 0 ? (
          history.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-background px-6 py-5 transition-all hover:border-foreground/20 hover:bg-muted/5"
            >
              <div className="space-y-1">
                <div className="text-lg font-bold text-foreground">
                  {formatDateLabel(entry.date)}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {[
                    entry.summary.added > 0 && (
                      <span key="added" className="text-green-600 font-medium">
                        +{entry.summary.added} added
                      </span>
                    ),
                    entry.summary.edited > 0 && (
                      <span key="edited" className="text-blue-600 font-medium">
                        {entry.summary.edited} edited
                      </span>
                    ),
                    entry.summary.removed > 0 && (
                      <span key="removed" className="text-red-600 font-medium">
                        -{entry.summary.removed} removed
                      </span>
                    ),
                  ]
                    .filter(Boolean)
                    .reduce((prev, curr, i) => (i === 0 ? [curr] : [...prev, <span key={`sep-${i}`}>·</span>, curr]), [] as React.ReactNode[])}
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="h-7 border-border bg-muted/40 text-foreground font-normal">
                  {entry.frames.length} frames
                </Badge>
                <Button size="sm" asChild>
                  <Link href={`/${folderSlug}/${pageId}/${entry.date}`}>View diff</Link>
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-background px-6 py-12 text-center text-sm text-muted-foreground">
            No changes have been captured for this page yet.
          </div>
        )}
      </div>
    </main>
  )
}
