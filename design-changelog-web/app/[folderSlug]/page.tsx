import Link from "next/link"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { loadIndex } from "@/lib/github"
import { getCurrentDateString } from "@/lib/date"
import { loadPagesForFolder } from "@/lib/catalog"
import type { PageCategory } from "@/lib/types"

const CATEGORY_LABELS: Record<PageCategory, string> = {
  "coach-app": "Coach app",
  "client-app": "Client app",
  web: "Web",
}

type PageProps = {
  params: Promise<{
    folderSlug: string
  }>
}

export default async function FolderPage({ params }: PageProps) {
  const { folderSlug } = await params
  const [index, pages] = await Promise.all([
    loadIndex(),
    loadPagesForFolder(folderSlug),
  ])
  const today = getCurrentDateString()

  if (pages.length === 0) {
    notFound()
  }

  const folderName = pages[0]?.folderName ?? folderSlug

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        crumbs={[
          { label: "Home", href: "/" },
          { label: folderName },
        ]}
        title={folderName}
        description={`${pages.length} tracked pages in this Figma file.`}
      />

      <div className="space-y-4">
        {pages.map((page) => {
          const latest = index.entries
            .filter((entry) => entry.sectionId === page.id)
            .sort((left, right) => right.date.localeCompare(left.date))[0]

          return (
            <div
              key={page.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-background px-6 py-5 transition-colors hover:border-foreground/20 hover:bg-muted/10"
            >
              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex items-center gap-3">
                  <div className="truncate font-semibold text-lg text-foreground">{page.pageName}</div>
                  <div className="flex flex-wrap gap-2">
                    {page.categories.map((category) => (
                      <Badge
                        key={category}
                        variant="outline"
                        className="border-border bg-muted/60 text-foreground text-[10px] uppercase tracking-wider"
                      >
                        {CATEGORY_LABELS[category] ?? category}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="truncate text-sm text-muted-foreground">
                  {page.figmaPageName ?? page.figmaFileName}
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                {latest ? (
                  <div className="text-right text-xs text-muted-foreground">
                    <div className="font-medium text-foreground">
                      {latest.date === today ? "Updated today" : "Last activity"}
                    </div>
                    <div>
                      {latest.date === today
                        ? `${latest.summary.edited} edited · ${latest.summary.added} added`
                        : latest.date}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground italic">No activity yet</div>
                )}
                
                <Button size="sm" asChild>
                  <Link href={`/${folderSlug}/${page.id}`}>History</Link>
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}
