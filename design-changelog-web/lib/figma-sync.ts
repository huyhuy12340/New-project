import { getCurrentDateString } from "@/lib/date"
import { loadPageCatalog } from "@/lib/catalog"
import {
  getFigmaFile,
  getFigmaImageUrls,
  getFigmaNodes,
  type FigmaNode,
} from "@/lib/figma-api"
import { access, mkdir, writeFile } from "fs/promises"
import path from "path"
import {
  clearBaselines,
  readBaseline,
  writeBaseline,
  writeEntryFile,
  writeLocalIndex,
  writeLocalPages,
} from "@/lib/data-store"
import { emptySummary } from "@/lib/diff-parser"
import { loadIndex } from "@/lib/github"
import type {
  BoundingBox,
  ChangelogEntry,
  ChangelogIndex,
  ChangeStatus,
  EntrySummary,
  FrameChange,
  LayerChange,
  TrackedPage,
} from "@/lib/types"

// ---------------------------------------------------------------------------
// Image cache helpers
// ---------------------------------------------------------------------------

function getImageCacheDir() {
  const root = process.env.DATA_REPO_PATH
  if (!root) throw new Error("DATA_REPO_PATH is not set")
  return path.join(path.resolve(root), "data", "images")
}

function getImageCachePath(nodeId: string) {
  const safe = nodeId.replace(/[^a-zA-Z0-9_-]/g, "-")
  return path.join(getImageCacheDir(), `${safe}.png`)
}

async function isCached(nodeId: string): Promise<boolean> {
  try { await access(getImageCachePath(nodeId)); return true } catch { return false }
}

async function prewarmImageCache(fileKey: string, frameIds: string[]): Promise<void> {
  const cacheDir = getImageCacheDir()
  await mkdir(cacheDir, { recursive: true })

  // Only fetch frames that are not yet on disk
  const uncached: string[] = []
  for (const id of frameIds) {
    if (!(await isCached(id))) uncached.push(id)
  }
  if (uncached.length === 0) {
    console.log("[ImageCache] All frames already cached — skipping fetch.")
    return
  }
  console.log(`[ImageCache] Pre-warming ${uncached.length} / ${frameIds.length} frames...`)

  // Batch-fetch URLs from Figma (scale:1 = 4× smaller & faster than scale:2)
  const BATCH = 50
  const allUrls: Record<string, string | null> = {}
  for (let i = 0; i < uncached.length; i += BATCH) {
    const batch = uncached.slice(i, i + BATCH)
    const urls = await getFigmaImageUrls(fileKey, batch, { scale: 1, format: "png" })
    Object.assign(allUrls, urls)
  }

  // Download all non-null URLs in parallel (50 at a time)
  const CHUNK = 50
  const ids = Object.keys(allUrls)
  for (let i = 0; i < ids.length; i += CHUNK) {
    await Promise.all(
      ids.slice(i, i + CHUNK).map(async (id) => {
        const url = allUrls[id]
        if (!url) return
        try {
          const res = await fetch(url, { cache: "no-store" })
          if (!res.ok) return
          const buf = Buffer.from(await res.arrayBuffer())
          await writeFile(getImageCachePath(id), buf)
        } catch { /* non-critical */ }
      })
    )
  }
  console.log(`[ImageCache] Done pre-warming.`)
}

// ---------------------------------------------------------------------------

type NodeSnapshot = {
  id: string
  name: string
  type: string
  visible: boolean
  text: string | null
  box: BoundingBox
  children: string[]
  fingerprint: string
}

type TreeSnapshot = {
  sourceId: string
  versionId: string
  versionCreatedAt: string
  fileName: string
  thumbnailUrl: string
  nodes: Record<string, NodeSnapshot>
  rootIds: string[]
}

function hashString(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function statusFromIndex(index: number): ChangeStatus {
  if (index % 3 === 0) return "added"
  if (index % 3 === 1) return "edited"
  return "removed"
}

function boundingBoxFromNode(node: FigmaNode): BoundingBox {
  const box = node.absoluteBoundingBox
  return {
    x: box?.x ?? 0,
    y: box?.y ?? 0,
    w: box?.width ?? 0,
    h: box?.height ?? 0,
  }
}

function buildFingerprint(node: FigmaNode) {
  return JSON.stringify({
    name: node.name,
    type: node.type,
    visible: node.visible ?? true,
    text: node.characters ?? null,
    x: node.absoluteBoundingBox?.x ?? 0,
    y: node.absoluteBoundingBox?.y ?? 0,
    w: node.absoluteBoundingBox?.width ?? 0,
    h: node.absoluteBoundingBox?.height ?? 0,
    fills: node.fills?.length ?? 0,
    strokes: node.strokes?.length ?? 0,
    effects: node.effects?.length ?? 0,
    opacity: node.opacity ?? 1,
  })
}

function flattenTree(node: FigmaNode, nodes: Record<string, NodeSnapshot>) {
  nodes[node.id] = {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: node.visible ?? true,
    text: node.characters ?? null,
    box: boundingBoxFromNode(node),
    children: node.children?.map((child) => child.id) ?? [],
    fingerprint: buildFingerprint(node),
  }

  for (const child of node.children ?? []) {
    flattenTree(child, nodes)
  }
}

function collectCandidateRoots(node: FigmaNode, candidates: FigmaNode[] = []) {
  if (node.type === "SECTION") {
    candidates.push(node)
  } else {
    // If it's not a section, keep searching children
    for (const child of node.children ?? []) {
      collectCandidateRoots(child, candidates)
    }
  }

  return candidates
}

/**
 * Recursively collect all renderable frames from a section tree.
 * Handles nested sections: when a SECTION is encountered inside another section,
 * its frames are attributed to that nested section (correct parent).
 */
function collectFramesFromSection(
  sectionId: string,
  sectionName: string,
  node: FigmaNode,
  frameEntries: Array<{ frameId: string; frameName: string; sectionId: string; sectionName: string }>,
  renderable: Set<string>,
) {
  for (const child of node.children ?? []) {
    if (child.type === "SECTION") {
      // Recurse into nested section — attribute its frames to the nested section itself
      collectFramesFromSection(child.id, child.name, child, frameEntries, renderable)
    } else if (renderable.has(child.type)) {
      frameEntries.push({
        frameId: child.id,
        frameName: child.name,
        sectionId,
        sectionName,
      })
    }
    // Don't recurse into renderable nodes — their children are layers, not trackable frames
  }
}

function cloneNodeSnapshot(node: NodeSnapshot, overrides: Partial<NodeSnapshot>): NodeSnapshot {
  return {
    ...node,
    ...overrides,
  }
}

function buildSyntheticBaseline(snapshot: TreeSnapshot): TreeSnapshot {
  const nodes: Record<string, NodeSnapshot> = {}

  for (const [id, node] of Object.entries(snapshot.nodes)) {
    const digest = hashString(`${snapshot.versionId}:${id}`)
    if (digest % 11 === 0) {
      continue
    }

    nodes[id] = digest % 7 === 0
      ? cloneNodeSnapshot(node, {
          name: `${node.name} (old)`,
          fingerprint: `${node.fingerprint}-edited`,
        })
      : node
  }

  if (snapshot.rootIds[0]) {
    const removedId = `${snapshot.rootIds[0]}-removed`
    nodes[removedId] = {
      id: removedId,
      name: "Legacy removed layer",
      type: "RECTANGLE",
      visible: true,
      text: null,
      box: { x: 0, y: 0, w: 320, h: 180 },
      children: [],
      fingerprint: `${snapshot.versionId}-removed`,
    }
  }

  return {
    ...snapshot,
    nodes,
  }
}

function parseChanges(current: NodeSnapshot | undefined, baseline: NodeSnapshot | undefined) {
  const changes: Array<{
    prop: string
    before: string | number | null
    after: string | number | null
  }> = []

  if (!current && baseline) {
    changes.push({ prop: "node", before: baseline.name, after: null })
    return changes
  }

  if (current && !baseline) {
    changes.push({ prop: "node", before: null, after: current.name })
    return changes
  }

  if (!current || !baseline) {
    return changes
  }

  if (current.name !== baseline.name) {
    changes.push({ prop: "name", before: baseline.name, after: current.name })
  }

  if (current.text !== baseline.text) {
    changes.push({ prop: "text", before: baseline.text, after: current.text })
  }

  if (current.box.w !== baseline.box.w || current.box.h !== baseline.box.h) {
    changes.push({
      prop: "size",
      before: `${baseline.box.w}x${baseline.box.h}`,
      after: `${current.box.w}x${current.box.h}`,
    })
  }

  return changes
}

function buildLayerChanges(
  currentRoot: NodeSnapshot,
  baselineRoot: NodeSnapshot | undefined,
  currentNodes: Record<string, NodeSnapshot>,
  baselineNodes: Record<string, NodeSnapshot>,
  simulate: boolean,
) {
  const childIds = [...new Set([...(currentRoot.children ?? []), ...(baselineRoot?.children ?? [])])]

  return childIds.map((childId, index) => {
    const current = currentNodes[childId]
    const baseline = baselineNodes[childId]

    let status: ChangeStatus
    if (!current && baseline) {
      status = "removed"
    } else if (current && !baseline) {
      status = simulate ? statusFromIndex(index) : "added"
    } else if (current && baseline && current.fingerprint !== baseline.fingerprint) {
      status = "edited"
    } else {
      status = simulate ? statusFromIndex(index) : "pending"
    }

    return {
      id: childId,
      name: current?.name ?? baseline?.name ?? "Unknown layer",
      type: current?.type ?? baseline?.type ?? "FRAME",
      status,
      path: `${currentRoot.name} / ${current?.name ?? baseline?.name ?? "Unknown layer"}`,
      boundingBox: current?.box ?? baseline?.box ?? { x: 0, y: 0, w: 0, h: 0 },
      changes: parseChanges(current, baseline),
    } satisfies LayerChange
  })
}

function buildFrameChanges(
  current: TreeSnapshot,
  baseline: TreeSnapshot | null,
  sourceUrl: string,
): { frames: FrameChange[]; summary: EntrySummary } {
  const simulate = baseline === null
  const baselineNodes = baseline?.nodes ?? {}
  const rootIds = [...new Set([...current.rootIds, ...(baseline?.rootIds ?? [])])]
  const frames: FrameChange[] = []
  const summary = emptySummary()

  for (const [index, rootId] of rootIds.entries()) {
    const currentRoot = current.nodes[rootId]
    const baselineRoot = baselineNodes[rootId]

    let status: ChangeStatus
    if (!currentRoot && baselineRoot) {
      status = "removed"
      summary.removed += 1
    } else if (currentRoot && !baselineRoot) {
      status = simulate ? statusFromIndex(index) : "added"
      if (status === "added") summary.added += 1
      if (status === "edited") summary.edited += 1
      if (status === "removed") summary.removed += 1
    } else if (currentRoot && baselineRoot && currentRoot.fingerprint !== baselineRoot.fingerprint) {
      status = "edited"
      summary.edited += 1
    } else {
      status = simulate ? statusFromIndex(index) : "pending"
      if (simulate) {
        if (status === "added") summary.added += 1
        if (status === "edited") summary.edited += 1
        if (status === "removed") summary.removed += 1
      }
    }

    const rootNode = currentRoot ?? baselineRoot
    if (!rootNode) {
      continue
    }

    const layers = buildLayerChanges(
      rootNode,
      baselineRoot,
      current.nodes,
      baselineNodes,
      simulate,
    )

    const frameStatus =
      currentRoot && baselineRoot && currentRoot.fingerprint !== baselineRoot.fingerprint
        ? "edited"
        : status

    if (simulate) {
      if (frameStatus === "added") summary.added += 1
      if (frameStatus === "edited") summary.edited += 1
      if (frameStatus === "removed") summary.removed += 1
    }

    frames.push({
      id: rootId,
      name: currentRoot?.name ?? baselineRoot?.name ?? "Unknown frame",
      status: frameStatus,
      figmaDeepLink: sourceUrl,
      boundingBox: currentRoot?.box ?? baselineRoot?.box ?? { x: 0, y: 0, w: 0, h: 0 },
      layers,
    })
  }

  if (frames.length === 0) {
    frames.push({
      id: `${current.sourceId}-fallback`,
      name: "Fallback frame",
      status: "edited",
      figmaDeepLink: sourceUrl,
      boundingBox: { x: 0, y: 0, w: 0, h: 0 },
      layers: [],
    })
    summary.edited += 1
  }

  if (simulate && summary.added === 0 && summary.edited === 0 && summary.removed === 0) {
    summary.edited = 1
  }

  return { frames, summary }
}

async function buildSourceOutput(source: TrackedPage) {
  try {
    // 1. Shallow fetch (depth 2) — only need to discover Section IDs
    const fileStructure = await getFigmaFile(source.figmaFileKey, { depth: 2 })
    const versionId = fileStructure.version ?? `${source.figmaFileKey}-version`
    const versionCreatedAt = new Date().toISOString()

    const pageNode = source.figmaPageId
      ? fileStructure.document.children?.find(c => c.id === source.figmaPageId)
      : null
    const searchRoot = pageNode ?? fileStructure.document

    // Collect Section stubs from shallow fetch (only id/name are reliable here)
    const sectionStubs = collectCandidateRoots(searchRoot)
    const sectionIds = sectionStubs.map(s => s.id)

    console.log(`[Sync] Discovered ${sectionIds.length} sections via shallow fetch.`)

    // 2. Fetch FULL node data for each Section via /nodes API
    //    This endpoint returns ALL children without truncation — unlike the depth-limited file fetch
    const sectionDataMap = (await getFigmaNodes(source.figmaFileKey, sectionIds)) as Record<string, { document?: FigmaNode }>

    // 3. Build frameEntries and nodes map from FULL /nodes response
    type FrameEntry = {
      frameId: string
      frameName: string
      sectionId: string
      sectionName: string
    }
    const frameEntries: FrameEntry[] = []
    const nodes: Record<string, NodeSnapshot> = {}
    const RENDERABLE = new Set(["FRAME", "GROUP", "COMPONENT", "COMPONENT_SET", "INSTANCE"])

    for (const sectionId of sectionIds) {
      const sectionDoc = sectionDataMap[sectionId]?.document
      if (!sectionDoc) continue

      // Flatten entire section tree into nodes map (for diff tracking)
      flattenTree(sectionDoc, nodes)

      // Recursively collect ALL frames — including those inside nested sections
      collectFramesFromSection(sectionDoc.id, sectionDoc.name, sectionDoc, frameEntries, RENDERABLE)
    }

    console.log(`[Sync] Found ${frameEntries.length} frames across ${sectionIds.length} sections.`)

    // Pre-warm image cache in the background — does NOT block sync.
    // Images are fetched and saved to disk progressively while the user sees results immediately.
    void prewarmImageCache(source.figmaFileKey, frameEntries.map(f => f.frameId))

    // Build snapshot
    const selectedNodes: Record<string, NodeSnapshot> = nodes
    const rootIds = sectionIds

    const currentSnapshot: TreeSnapshot = {
      sourceId: source.id,
      versionId,
      versionCreatedAt,
      fileName: fileStructure.name,
      thumbnailUrl: fileStructure.thumbnailUrl ?? "",
      nodes: selectedNodes,
      rootIds,
    }

    const baseline = (await readBaseline(source.id)) as TreeSnapshot | null
    const baselineNodes = baseline?.nodes ?? {}

    // Build FrameChange per frame — thumbnails are loaded on-demand via /api/proxy-image
    const frames: FrameChange[] = frameEntries.map(({ frameId, frameName, sectionId, sectionName }) => {
      const current = selectedNodes[frameId]
      const base = baselineNodes[frameId]

      let status: ChangeStatus
      if (!current && base) status = "removed"
      else if (current && !base) status = "added"   // always 'added' whether or not baseline exists
      else if (current && base && current.fingerprint !== base.fingerprint) status = "edited"
      else status = "pending"

      const root = current ?? base
      const layers = root
        ? buildLayerChanges(root, base, selectedNodes, baselineNodes, false)
        : []

      return {
        id: frameId,
        name: frameName,
        sectionId,
        sectionName,
        thumbnail: null,
        status,
        figmaDeepLink: source.figmaUrl,
        boundingBox: (current ?? base)?.box ?? { x: 0, y: 0, w: 0, h: 0 },
        layers,
      }
    })

    // Summarise across all frames
    const summary = emptySummary()
    for (const f of frames) {
      if (f.status === "added") summary.added += 1
      else if (f.status === "edited") summary.edited += 1
      else if (f.status === "removed") summary.removed += 1
    }

    // Keep a file-level image for the diff viewer (use first section node)
    const firstSectionId = rootIds[0]
    const afterImage = fileStructure.thumbnailUrl ?? ""
    const beforeImage = afterImage

    const date = getCurrentDateString()
    const entry: ChangelogEntry = {
      id: `${source.id}-${versionId}`,
      sourceId: source.id,
      versionId,
      sectionId: source.id,
      sectionName: source.pageName || source.figmaPageName || source.folderName,
      date,
      lastDetectedAt: versionCreatedAt,
      summary,
      diffFile: `data/entries/${source.id}-${versionId}.json`,
      beforeImage,
      afterImage,
      sectionThumbnail: null,
      figmaDeepLink: source.figmaUrl,
      frames,
    }

    return {
      source,
      snapshot: currentSnapshot,
      entry,
      versionId,
      versionCreatedAt,
      archived: false,
    }
  } catch (err) {
    console.error("[Sync Error]", err)
    return {
      source,
      snapshot: null,
      versionId: null,
      versionCreatedAt: new Date().toISOString(),
      archived: true,
      entry: null,
    }
  }
}

export async function syncFigmaSources() {
  const catalog = await loadPageCatalog()
  const activePages = catalog.pages.filter((page) => !page.archived)
  if (activePages.length === 0) {
    return loadIndex()
  }

  const outputs = await Promise.all(activePages.map((page) => buildSourceOutput(page)))
  const archivedIds = new Set(outputs.filter((output) => output.archived).map((output) => output.source.id))

  if (archivedIds.size > 0) {
    await writeLocalPages({
      pages: catalog.pages.map((page) =>
        archivedIds.has(page.id) ? { ...page, archived: true } : page,
      ),
    })
  }

  const activeOutputs = outputs.filter((output): output is (typeof outputs)[number] & { entry: ChangelogEntry } => Boolean(output.entry))

  const existingIndex = await loadIndex()
  const newEntries = activeOutputs.map(({ entry }) => entry)
  
  // Combine new entries with existing ones, avoiding duplicates if any
  const combinedEntries = [...newEntries]
  for (const oldEntry of existingIndex.entries) {
    if (!combinedEntries.find(e => e.id === oldEntry.id)) {
      combinedEntries.push(oldEntry)
    }
  }

  const index: ChangelogIndex = {
    lastUpdated: new Date().toISOString(),
    figmaFileKey: catalog.pages[0]?.figmaFileKey ?? "",
    figmaFileName: catalog.pages[0]?.figmaFileName ?? "",
    sources: outputs.map(({ source, versionId, versionCreatedAt, entry, archived }) => ({
      id: source.id,
      url: source.figmaUrl,
      fileKey: source.figmaFileKey,
      fileName: source.figmaFileName,
      nodeId: source.figmaPageId,
      nodeName: source.figmaPageName ?? null,
      archived: archived ?? false,
      sectionId: source.id,
      sectionName: entry?.sectionName ?? source.pageName,
      lastVersionId: versionId,
      lastVersionAt: versionCreatedAt,
    })),
    // Keep the most recent 100 entries total
    entries: combinedEntries.slice(0, 100),
  }

  await writeLocalIndex(index)
  await Promise.all(activeOutputs.map(({ entry }) => writeEntryFile(entry)))
  await Promise.all(activeOutputs.map(({ source, snapshot }) => writeBaseline(source.id, snapshot)))

  return index
}

export async function resetFigmaBaselines() {
  await clearBaselines()
}
