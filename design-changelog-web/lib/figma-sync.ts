import { getCurrentDateString } from "@/lib/date"
import { loadPageCatalog } from "@/lib/catalog"
import {
  getFigmaFile,
  getFigmaImageUrls,
  type FigmaNode,
} from "@/lib/figma-api"
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
  const isRenderable = node.type !== "DOCUMENT" && node.type !== "CANVAS"
  if (isRenderable && (node.children?.length ?? 0) > 0) {
    candidates.push(node)
  }

  for (const child of node.children ?? []) {
    collectCandidateRoots(child, candidates)
  }

  return candidates
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
      changes: parseChanges(current, baseline).slice(0, 3),
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
  const rootIds = [...new Set([...current.rootIds, ...(baseline?.rootIds ?? [])])].slice(0, 3)
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
    ).slice(0, 5)

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
    const file = await getFigmaFile(source.figmaFileKey)
    const versionId = file.version ?? `${source.figmaFileKey}-version`
    const versionCreatedAt = new Date().toISOString()

    const nodes: Record<string, NodeSnapshot> = {}
    flattenTree(file.document, nodes)

    const candidateRoots =
      source.figmaPageId && nodes[source.figmaPageId]
        ? [nodes[source.figmaPageId]]
        : collectCandidateRoots(file.document).slice(0, 3)

    const rootIds =
      candidateRoots.length > 0
        ? candidateRoots.map((node) => node.id)
        : Object.keys(nodes).slice(0, 3)

    if (source.figmaPageId && nodes[source.figmaPageId] && !rootIds.includes(source.figmaPageId)) {
      rootIds.unshift(source.figmaPageId)
    }

    const selectedNodes: Record<string, NodeSnapshot> = {}
    for (const rootId of rootIds.slice(0, 3)) {
      const root = nodes[rootId]
      if (!root) continue
      selectedNodes[rootId] = root
      for (const childId of root.children) {
        if (nodes[childId]) {
          selectedNodes[childId] = nodes[childId]
        }
      }
    }

    const currentSnapshot: TreeSnapshot = {
      sourceId: source.id,
      versionId,
      versionCreatedAt,
      fileName: file.name,
      thumbnailUrl: file.thumbnailUrl ?? "",
      nodes: selectedNodes,
      rootIds: rootIds.slice(0, 3),
    }

    const baseline = (await readBaseline(source.id)) as TreeSnapshot | null
    const comparisonBaseline = baseline ?? buildSyntheticBaseline(currentSnapshot)
    const { frames, summary } = buildFrameChanges(
      currentSnapshot,
      comparisonBaseline,
      source.figmaUrl,
    )

    const selectedRootImageId = currentSnapshot.rootIds[0]
    const images = (await getFigmaImageUrls(
      source.figmaFileKey,
      selectedRootImageId ? [selectedRootImageId] : [],
    ).catch(() => ({}))) as Record<string, string | null>
    const afterImage =
      selectedRootImageId && images[selectedRootImageId]
        ? images[selectedRootImageId]!
        : file.thumbnailUrl ?? ""
    const beforeImage = file.thumbnailUrl ?? afterImage

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
  } catch {
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
    entries: activeOutputs.map(({ entry }) => entry),
  }

  await writeLocalIndex(index)
  await Promise.all(activeOutputs.map(({ entry }) => writeEntryFile(entry)))
  await Promise.all(activeOutputs.map(({ source, snapshot }) => writeBaseline(source.id, snapshot)))

  return index
}

export async function resetFigmaBaselines() {
  await clearBaselines()
}
