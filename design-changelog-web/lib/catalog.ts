import { readLocalPages, writeLocalPages } from "@/lib/data-store"
import { loadIndex } from "@/lib/github"
import type { FolderSummary, PageCategory, PageCatalog, TrackedPage } from "@/lib/types"

export function toFolderSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function emptyCatalog(): PageCatalog {
  return { pages: [] }
}

function normalizePage(
  page: Partial<TrackedPage> & { platform?: string; platforms?: string[]; category?: PageCategory | PageCategory[] },
): TrackedPage {
  const categories = Array.isArray(page.categories)
    ? page.categories
    : Array.isArray(page.category)
      ? page.category
      : page.category
        ? [page.category]
        : ["web"]

  return {
    id: page.id ?? "",
    folderSlug: page.folderSlug ?? "",
    folderName: page.folderName ?? "",
    pageName: page.pageName ?? "",
    figmaFileKey: page.figmaFileKey ?? "",
    figmaFileName: page.figmaFileName ?? "",
    figmaPageId: page.figmaPageId ?? null,
    figmaPageName: page.figmaPageName ?? null,
    figmaUrl: page.figmaUrl ?? "",
    categories: [...new Set(categories)] as PageCategory[],
    addedAt: page.addedAt ?? new Date().toISOString(),
    addedBy: page.addedBy ?? "system",
    archived: page.archived ?? false,
  }
}

function normalizeCatalog(value: Partial<PageCatalog> | null | undefined): PageCatalog {
  return {
    pages: Array.isArray(value?.pages) ? value.pages.map((page) => normalizePage(page as Partial<TrackedPage> & { platforms?: string[] })) : [],
  }
}

export async function loadPageCatalog(): Promise<PageCatalog> {
  const local = await readLocalPages()
  return local ? normalizeCatalog(local) : emptyCatalog()
}

export async function savePageCatalog(catalog: PageCatalog) {
  await writeLocalPages(normalizeCatalog(catalog))
}

export async function upsertTrackedPage(page: TrackedPage) {
  const catalog = await loadPageCatalog()
  const pages = [...catalog.pages]
  const existingIndex = pages.findIndex((entry) => entry.id === page.id)

  if (existingIndex >= 0) {
    const existing = pages[existingIndex]
      pages[existingIndex] = {
        ...existing,
        ...page,
        addedAt: existing.addedAt,
        addedBy: existing.addedBy,
        archived: page.archived ?? existing.archived ?? false,
      }
  } else {
    pages.push(normalizePage(page))
  }

  const nextCatalog = { pages }
  await savePageCatalog(nextCatalog)
  return nextCatalog
}

export async function removeTrackedPage(pageId: string) {
  const catalog = await loadPageCatalog()
  const pages = catalog.pages.filter((page) => page.id !== pageId)
  const nextCatalog = { pages }
  await savePageCatalog(nextCatalog)
  return nextCatalog
}

export function groupPagesByFolder(pages: TrackedPage[]) {
  const groups = new Map<string, TrackedPage[]>()
  for (const page of pages) {
    const current = groups.get(page.folderSlug) ?? []
    current.push(page)
    groups.set(page.folderSlug, current)
  }

  return [...groups.entries()].map(([folderSlug, groupedPages]) => ({
    folderSlug,
    folderName: groupedPages[0]?.folderName ?? folderSlug,
    pages: groupedPages.sort((a, b) => a.pageName.localeCompare(b.pageName)),
  }))
}

export async function loadFolderSummaries(): Promise<FolderSummary[]> {
  const catalog = await loadPageCatalog()
  const index = await loadIndex()
  const grouped = groupPagesByFolder(catalog.pages)

  return grouped
    .map((group) => {
      const latestDate = index.entries
        .filter((entry) => group.pages.some((page) => page.id === entry.sectionId))
        .sort((left, right) => right.date.localeCompare(left.date))[0]?.date ?? ""

      return {
        folderSlug: group.folderSlug,
        folderName: group.folderName,
        pageCount: group.pages.length,
        latestDate,
      }
    })
    .sort((left, right) => right.latestDate.localeCompare(left.latestDate))
}

export async function loadRecentPages(limit = 6) {
  const catalog = await loadPageCatalog()
  const index = await loadIndex()

  return [...catalog.pages]
    .map((page) => {
      const latestEntry = index.entries
        .filter((entry) => entry.sectionId === page.id)
        .sort((left, right) => right.date.localeCompare(left.date))[0]

      return {
        ...page,
        lastActivityAt: latestEntry?.date ?? page.addedAt,
      }
    })
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
    .slice(0, limit)
}

export async function findPageById(pageId: string) {
  const catalog = await loadPageCatalog()
  return catalog.pages.find((page) => page.id === pageId) ?? null
}

export async function loadPagesForFolder(folderSlug: string) {
  const catalog = await loadPageCatalog()
  return catalog.pages.filter((page) => page.folderSlug === folderSlug)
}
