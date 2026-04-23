import { notFound } from "next/navigation"

import { PageHeader } from "@/components/page-header"
import { FigmaLink } from "@/components/ui/FigmaLink"
import { DiffDetailWorkspace } from "@/components/DiffViewer/DiffDetailWorkspace"
import { formatDateLabel } from "@/lib/date"
import { loadSectionEntry } from "@/lib/github"
import { findPageById } from "@/lib/catalog"

type PageProps = {
  params: Promise<{
    folderSlug: string
    pageId: string
    date: string
  }>
}

export default async function DiffDetailPage({ params }: PageProps) {
  const { folderSlug, pageId, date } = await params
  const [entry, page] = await Promise.all([loadSectionEntry(pageId, date), findPageById(pageId)])

  if (!entry || !page || page.folderSlug !== folderSlug) {
    notFound()
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        crumbs={[
          { label: "Home", href: "/" },
          { label: page.folderName, href: `/${folderSlug}` },
          { label: page.pageName, href: `/${folderSlug}/${pageId}` },
          { label: "Diff detail" },
        ]}
        title={page.pageName}
        description={formatDateLabel(date)}
        action={<FigmaLink href={entry.figmaDeepLink} label="Open in Figma" />}
      />

      <DiffDetailWorkspace entry={entry} />
    </main>
  )
}
