import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { loadPageCatalog, loadRecentPages } from "@/lib/catalog"
import type { PageCategory } from "@/lib/types"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { readUserState } from "@/lib/data-store"
import { Layout } from "lucide-react"

const CATEGORY_LABELS: Record<PageCategory, string> = {
  "coach-app": "Coach app",
  "client-app": "Client app",
  web: "Web",
}

export default async function HomePage() {
  const catalog = await loadPageCatalog()
  const session = await getServerSession(authOptions)
  const userState = session?.user?.email ? await readUserState(session.user.email) : null

  if (catalog.pages.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <Card className="border-dashed">
          <CardHeader className="space-y-3 border-b border-border bg-muted/20">
            <CardTitle className="text-2xl">No tracked pages yet</CardTitle>
            <CardDescription>
              Add the first exact Figma page URL to create the registry and start polling changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="text-sm text-muted-foreground">
              Paste the exact page canvas link from Figma using the "Add Page" button in the header.
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  const recentPages = await loadRecentPages(12)

  return (
    <main className="flex w-full flex-col gap-12 px-16 pt-5 pb-12">
      <section className="space-y-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Daily design changes
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Browse recent Figma activity by page. This view stays lightweight and read-only.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Recently updated</h2>
        </div>
        
        <div className="grid gap-4 sm:grid-cols-2">
          {recentPages.map((page) => {
            const lastSeenVersionId = userState?.pageStates[page.id]?.lastSeenVersionId || null
            const hasLocalChanges = page.lastVersionId && page.lastVersionId !== lastSeenVersionId

            return (
              <Link
                key={page.id}
                href={`/${page.folderSlug}/${page.id}`}
                className="flex flex-col gap-3 rounded-xl border border-border bg-background p-5 transition-all hover:border-foreground/20 hover:bg-muted/5 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-3">
                    <div className="relative">
                      <Layout className="size-5 text-muted-foreground" />
                      {hasLocalChanges && (
                        <div className="absolute -top-1 -right-1 size-2 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-foreground">{page.pageName}</div>
                      <div className="truncate text-xs text-muted-foreground">{page.folderName}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5">
                  {page.categories.map((cat) => (
                    <Badge key={cat} variant="secondary" className="px-1.5 py-0 text-[10px] uppercase">
                      {CATEGORY_LABELS[cat] ?? cat}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Last activity
                </span>
                <span className="text-xs font-medium text-foreground">
                  {page.lastActivityAt ? new Date(page.lastActivityAt).toLocaleDateString() : "Never"}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
      </section>
    </main>
  )
}
