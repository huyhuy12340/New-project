import { getFigmaNodes, type FigmaNode } from "@/lib/figma-api"
import type { ResolvedFigmaPage } from "@/lib/types"

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function humanizeLabel(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export { humanizeLabel }

function isPageNode(node: FigmaNode) {
  return node.type === "CANVAS" || node.type === "PAGE"
}

export function parseFigmaShareUrl(input: string) {
  const parsed = new URL(input)
  if (parsed.hostname !== "www.figma.com" && parsed.hostname !== "figma.com") {
    throw new Error("The URL must be a Figma link.")
  }

  const parts = parsed.pathname.split("/").filter(Boolean)
  const sourceIndex = parts.findIndex((part) => part === "design" || part === "file")
  if (sourceIndex < 0) {
    throw new Error("The URL must point to a Figma file or design page.")
  }

  const fileKey = parts[sourceIndex + 1] ?? ""
  if (!fileKey) {
    throw new Error("The Figma file key could not be determined.")
  }

  const fileName = parts[sourceIndex + 2] ? decodeURIComponent(parts[sourceIndex + 2]) : ""
  const nodeIdRaw = parsed.searchParams.get("node-id")
  const nodeId = nodeIdRaw ? nodeIdRaw.replace(/-/g, ":") : null

  return {
    fileKey,
    fileName,
    nodeId,
  }
}

export function toFolderSlug(value: string) {
  return slugify(value)
}

export function buildTrackedPageId(fileKey: string, pageId: string) {
  return `page-${slugify(`${fileKey}-${pageId}`)}`
}

export async function resolveFigmaPageFromUrl(input: string): Promise<ResolvedFigmaPage> {
  const { fileKey, fileName, nodeId } = parseFigmaShareUrl(input)
  if (!nodeId) {
    throw new Error("Paste a Figma page URL that includes a node-id.")
  }

  const nodes = await getFigmaNodes(fileKey, [nodeId])
  const node = nodes[nodeId]?.document

  if (!node) {
    throw new Error("Figma could not resolve that node. Copy the exact page link from the page canvas.")
  }

  if (!isPageNode(node)) {
    throw new Error(
      `That link resolves to a ${node.type.toLowerCase()} not a page canvas. Copy the link from the page canvas itself.`,
    )
  }

  const resolvedFileName = humanizeLabel(fileName || fileKey)
  const resolvedPageName = humanizeLabel(node.name || resolvedFileName)
  const resolvedPageId = node.id
  const normalizedUrl = `https://www.figma.com/design/${fileKey}/${encodeURIComponent(
    fileName || resolvedFileName,
  )}?node-id=${encodeURIComponent(resolvedPageId.replace(/:/g, "-"))}`

  return {
    figmaFileKey: fileKey,
    figmaFileName: resolvedFileName,
    figmaPageId: resolvedPageId,
    figmaPageName: resolvedPageName,
    figmaUrl: normalizedUrl,
    folderSlug: toFolderSlug(resolvedFileName),
    folderName: resolvedFileName,
    pageName: resolvedPageName,
  }
}
