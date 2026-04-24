import { getCurrentDateString } from "@/lib/date"
import { loadPageCatalog } from "@/lib/catalog"
import {
  getFigmaFile,
  getFigmaNodes,
  type FigmaNode,
} from "@/lib/figma-api"
import {
  clearBaselines,
  readBaseline,
  writeBaseline,
  readSnapshot,
  writeSnapshot,
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

type NodeSnapshot = {
  id: string
  name: string
  type: string
  visible: boolean
  text: string | null
  box: BoundingBox
  children: string[]
  fingerprint: string      // recursive hash (self + children)
  selfFingerprint: string  // local properties hash
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
  // node-only fingerprint (self)
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

function flattenTree(node: FigmaNode, nodes: Record<string, NodeSnapshot>): string {
  const selfFp = buildFingerprint(node)
  const childFps: string[] = []

  for (const child of node.children ?? []) {
    const childRecFp = flattenTree(child, nodes)
    childFps.push(childRecFp)
  }

  const recFp = String(hashString(selfFp + childFps.join("")))

  nodes[node.id] = {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: node.visible ?? true,
    text: node.characters ?? null,
    box: boundingBoxFromNode(node),
    children: node.children?.map((child) => child.id) ?? [],
    fingerprint: recFp, // recursive
    selfFingerprint: selfFp, // node-only
  }

  return recFp
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
      selfFingerprint: `${snapshot.versionId}-removed`,
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
  const results: LayerChange[] = []

  // Recursive search for "Shallowest Modified Node"
  function findChangeRoots(
    curr: NodeSnapshot | undefined,
    base: NodeSnapshot | undefined,
    depth: number
  ) {
    // 1. If both are missing, do nothing
    if (!curr && !base) return

    // 2. If one is missing (Added or Removed), it's a change root
    if (!curr || !base) {
      const target = curr || base!
      results.push({
        id: target.id,
        name: target.name,
        type: target.type,
        status: !base ? "added" : "removed",
        path: target.name,
        boundingBox: target.box,
        changes: parseChanges(curr, base),
      })
      return // STOP digging — parent change reported
    }

    // 3. Both exist. Check for SELF change (color, size, text, etc.)
    const selfChanged = curr.selfFingerprint !== base.selfFingerprint

    if (selfChanged) {
      // This is a change root — record and STOP
      results.push({
        id: curr.id,
        name: curr.name,
        type: curr.type,
        status: "edited",
        path: curr.name,
        boundingBox: curr.box,
        changes: parseChanges(curr, base),
      })
      return // STOP digging — parent change reported
    }

    // 4. No self-change. Check if ANYTHING in the subtree changed
    const subtreeChanged = curr.fingerprint !== base.fingerprint

    if (subtreeChanged) {
      // Something below changed — DIG DEEPER into children
      const allChildIds = [...new Set([...(curr.children ?? []), ...(base.children ?? [])])]
      for (const childId of allChildIds) {
        findChangeRoots(currentNodes[childId], baselineNodes[childId], depth + 1)
      }
    }
    // Else: total match, stop here
  }

  // Start searching from all level-1 children of the Frame
  const startChildIds = [...new Set([...(currentRoot.children ?? []), ...(baselineRoot?.children ?? [])])]
  for (const childId of startChildIds) {
    findChangeRoots(currentNodes[childId], baselineNodes[childId], 0)
  }

  return results
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

function findNodeRecursive(node: FigmaNode, id: string): FigmaNode | null {
  if (node.id === id) return node
  for (const child of node.children ?? []) {
    const found = findNodeRecursive(child, id)
    if (found) return found
  }
  return null
}

async function buildSourceOutput(source: TrackedPage) {
  try {
    const RENDERABLE = new Set(["FRAME", "GROUP", "COMPONENT", "COMPONENT_SET", "INSTANCE"])
    type FrameEntry = { frameId: string; frameName: string; sectionId: string; sectionName: string }

    let fileName = source.figmaFileName
    let versionCreatedAt = new Date().toISOString()
    let versionId = `v-${Date.now()}`
    let searchRoot: FigmaNode | null = null

    if (source.figmaPageId) {
      const nodesResponse = await getFigmaNodes(source.figmaFileKey, [source.figmaPageId]) as Record<string, { document?: FigmaNode }>
      const nodeDoc = nodesResponse[source.figmaPageId]?.document
      if (nodeDoc) {
        searchRoot = nodeDoc
        source.pageName = nodeDoc.name
        source.figmaPageName = nodeDoc.name
      }
    }

    if (!searchRoot) {
      const fileStructure = await getFigmaFile(source.figmaFileKey, { depth: 2 })
      fileName = fileStructure.name
      versionId = fileStructure.version ?? versionId
      const targetNode = source.figmaPageId
        ? findNodeRecursive(fileStructure.document, source.figmaPageId)
        : null
      if (targetNode) {
        source.pageName = targetNode.name
        source.figmaPageName = targetNode.name
      }
      searchRoot = targetNode ?? fileStructure.document
    }

    // 2. Parse sections + frames directly from the already-fetched tree
    const frameEntries: FrameEntry[] = []
    const nodes: Record<string, NodeSnapshot> = {}

    if (searchRoot.type === "SECTION") {
      flattenTree(searchRoot, nodes)
      collectFramesFromSection(searchRoot.id, searchRoot.name, searchRoot, frameEntries, RENDERABLE)
    } else {
      const sections = collectCandidateRoots(searchRoot)
      for (const section of sections) {
        flattenTree(section, nodes)
        collectFramesFromSection(section.id, section.name, section, frameEntries, RENDERABLE)
      }
    }

    // 3. Build current snapshot
    const currentSnapshot: TreeSnapshot = {
      sourceId: source.id,
      versionId,
      versionCreatedAt,
      fileName,
      thumbnailUrl: "",
      nodes,
      rootIds: [...new Set(frameEntries.map(f => f.sectionId))],
    }

    // 4. Persistence: Save the full snapshot for historical comparison
    await writeSnapshot(source.id, versionId, currentSnapshot)

    // 5. Compare against baseline (global fallback)
    const baseline = (await readBaseline(source.id)) as TreeSnapshot | null
    const baselineNodes = baseline?.nodes ?? {}

    const frames: FrameChange[] = frameEntries.map(({ frameId, frameName, sectionId, sectionName }) => {
      const current = nodes[frameId]
      const base = baselineNodes[frameId]
      
      const root = current ?? base
      const layers = root ? buildLayerChanges(root, base, nodes, baselineNodes, false) : []
      
      return {
        id: frameId,
        name: frameName,
        sectionId,
        sectionName,
        status: !base ? "added" : (current.fingerprint !== base.fingerprint ? "edited" : "pending"),
        figmaDeepLink: `https://www.figma.com/design/${source.figmaFileKey}?node-id=${frameId}`,
        boundingBox: current?.box ?? base?.box ?? { x: 0, y: 0, w: 0, h: 0 },
        layers,
      }
    })

    // 6. Calculate summary
    const summary = emptySummary()
    for (const f of frames) {
      if (f.status === "added") summary.added += 1
      else if (f.status === "edited") summary.edited += 1
      else if (f.status === "removed") summary.removed += 1
    }

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
      beforeImage: "",
      afterImage: "",
      sectionThumbnail: null,
      figmaDeepLink: source.figmaUrl,
      frames,
    }

    return { source, snapshot: currentSnapshot, entry, versionId, versionCreatedAt, archived: false }
  } catch (err) {
    console.error("[Sync Error]", err)
    return { source, snapshot: null, versionId: null, versionCreatedAt: new Date().toISOString(), archived: true, entry: null }
  }
}

/**
 * Calculates a personalized diff between two specific snapshots.
 */
export async function getPersonalizedFrameChanges(
  sourceId: string,
  baselineVersionId: string | null,
  currentVersionId: string
): Promise<FrameChange[]> {
  const [currentSnapshot, baselineSnapshot] = await Promise.all([
    readSnapshot(sourceId, currentVersionId),
    baselineVersionId ? readSnapshot(sourceId, baselineVersionId) : Promise.resolve(null)
  ])

  if (!currentSnapshot) return []

  const nodes = currentSnapshot.nodes
  const baselineNodes = baselineSnapshot?.nodes ?? {}

  // Simplified recreation of the frame list from snapshot
  // We can't use buildSourceOutput here because we don't want to hit Figma
  // Instead, we identify nodes that look like root frames
  const frameIds = Object.keys(nodes).filter(id => 
    nodes[id].type === "FRAME" && currentSnapshot.rootIds.includes(nodes[id].id)
  )

  // Reconstruct parent mapping from rootIds (sections) to their children (frames)
  const parentMap: Record<string, string> = {}
  for (const rootId of currentSnapshot.rootIds) {
    const section = nodes[rootId]
    if (section && section.children) {
      for (const childId of section.children) {
        parentMap[childId] = rootId
      }
    }
  }

  const frames: FrameChange[] = []
  for (const nodeId in nodes) {
    const node = nodes[nodeId]
    if (node.type === "FRAME") {
      // Only process frames that were top-level within sections
      if (!parentMap[nodeId]) continue

      const current = node
      const base = baselineNodes[nodeId]
      
      const layers = buildLayerChanges(current, base, nodes, baselineNodes, false)
      if (layers.length === 0 && base && current.fingerprint === base.fingerprint) continue

      const sectionId = parentMap[node.id]
      const section = nodes[sectionId]

      frames.push({
        id: node.id,
        name: node.name,
        sectionId: sectionId,
        sectionName: section?.name || "Other",
        status: !base ? "added" : (current.fingerprint !== base.fingerprint ? "edited" : "pending"),
        figmaDeepLink: "", // Can be reconstructed if needed
        boundingBox: current.box,
        layers,
      })
    }
  }

  return frames
}

export async function syncFigmaSources() {
  const catalog = await loadPageCatalog()
  const activePages = catalog.pages.filter((page) => !page.archived)
  if (activePages.length === 0) {
    return loadIndex()
  }

  const outputs = await Promise.all(activePages.map((page) => buildSourceOutput(page)))
  return commitOutputs(catalog, outputs)
}

/**
 * Sync a single page by ID — used by the "Sync now" button.
 * Much faster than syncing all pages.
 */
export async function syncSinglePage(pageId: string) {
  const catalog = await loadPageCatalog()
  // Find by ID regardless of archived status — allows re-syncing failed pages
  const page = catalog.pages.find((p) => p.id === pageId)
  if (!page) throw new Error(`Page ${pageId} not found in catalog`)

  const output = await buildSourceOutput(page)
  return commitOutputs(catalog, [output])
}

async function commitOutputs(
  catalog: Awaited<ReturnType<typeof loadPageCatalog>>,
  outputs: Awaited<ReturnType<typeof buildSourceOutput>>[]
) {
  // Update catalog — only update name on success, never overwrite archived=true on failure
  const updatedPages = catalog.pages.map((p) => {
    const output = outputs.find((o) => o.source.id === p.id)
    if (!output) return p
    // If sync failed (entry is null), preserve existing page data as-is
    if (!output.entry) return p
    return {
      ...p,
      pageName: output.source.pageName,
      figmaPageName: output.source.figmaPageName,
      lastVersionId: output.versionId || p.lastVersionId,
      lastActivityAt: output.versionCreatedAt || p.lastActivityAt,
      // Only mark archived if explicitly set AND it was already archived before
      archived: p.archived ?? false,
    }
  })

  await writeLocalPages({ pages: updatedPages })

  const activeOutputs = outputs.filter(
    (output): output is (typeof outputs)[number] & { entry: ChangelogEntry } => Boolean(output.entry)
  )

  const existingIndex = await loadIndex()
  const newEntries = activeOutputs.map(({ entry }) => entry)

  const combinedEntries = [...newEntries]
  for (const oldEntry of existingIndex.entries) {
    if (!combinedEntries.find(e => e.id === oldEntry.id)) {
      combinedEntries.push(oldEntry)
    }
  }

  // Merge sources: keep existing sources for pages not in this sync batch
  const existingSources = existingIndex.sources ?? []
  const updatedSources = [...existingSources]
  for (const { source, versionId, versionCreatedAt, entry, archived } of outputs) {
    const idx = updatedSources.findIndex((s) => s.id === source.id)
    const sourceEntry = {
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
    }
    if (idx >= 0) updatedSources[idx] = sourceEntry
    else updatedSources.push(sourceEntry)
  }

  const index: ChangelogIndex = {
    lastUpdated: new Date().toISOString(),
    figmaFileKey: catalog.pages[0]?.figmaFileKey ?? "",
    figmaFileName: catalog.pages[0]?.figmaFileName ?? "",
    sources: updatedSources,
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
