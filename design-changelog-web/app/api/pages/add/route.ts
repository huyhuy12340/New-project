import { NextResponse } from "next/server"
import { z } from "zod"

import {
  buildTrackedPageId,
  humanizeLabel,
  parseFigmaShareUrl,
  resolveFigmaPageFromUrl,
  toFolderSlug,
} from "@/lib/figma-registry"
import { upsertTrackedPage } from "@/lib/catalog"
import type { PageCategory, TrackedPage } from "@/lib/types"

export const runtime = "nodejs"

const bodySchema = z.object({
  url: z.string().url(),
  pageName: z.string().min(1),
  categories: z.array(z.enum(["coach-app", "client-app", "web"])).min(1),
  addedBy: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json())
    const { fileKey, fileName, nodeId } = parseFigmaShareUrl(body.url)
    if (!nodeId) {
      throw new Error("Paste a Figma page URL that includes a node-id.")
    }

    const fallbackFileName = humanizeLabel(fileName || fileKey)
    const resolution = await Promise.race([
      resolveFigmaPageFromUrl(body.url)
        .then((resolved) => ({ status: "resolved" as const, resolved }))
        .catch((error) => ({
          status: "error" as const,
          error: error instanceof Error ? error : new Error("Unable to resolve the Figma page."),
        })),
      new Promise<{ status: "timeout" }>((resolve) => {
        setTimeout(() => resolve({ status: "timeout" }), 1800)
      }),
    ])

    const resolvedFileName = resolution.status === "resolved" ? resolution.resolved.folderName : fallbackFileName
    const pageId = buildTrackedPageId(fileKey, nodeId)
    const normalizedPageName =
      resolution.status === "resolved" ? resolution.resolved.pageName : body.pageName.trim()
    const normalizedUrl =
      resolution.status === "resolved"
        ? resolution.resolved.figmaUrl
        : `https://www.figma.com/design/${fileKey}/${encodeURIComponent(
            fileName || resolvedFileName,
          )}?node-id=${encodeURIComponent(nodeId.replace(/:/g, "-"))}`

    if (resolution.status === "error") {
      const message = resolution.error.message
      if (!/timeout|aborted/i.test(message)) {
        throw resolution.error
      }
    }

    const page: TrackedPage = {
      id: pageId,
      folderSlug: toFolderSlug(resolvedFileName),
      folderName: resolvedFileName,
      pageName: normalizedPageName,
      figmaFileKey: fileKey,
      figmaFileName: resolvedFileName,
      figmaPageId: nodeId,
      figmaPageName: normalizedPageName,
      figmaUrl: normalizedUrl,
      categories: body.categories as PageCategory[],
      addedAt: new Date().toISOString(),
      addedBy: body.addedBy ?? "system",
      lastActivityAt: new Date().toISOString(),
    }

    const catalog = await upsertTrackedPage(page)

    return NextResponse.json({
      ok: true,
      page,
      totalPages: catalog.pages.length,
    })
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Invalid payload."
        : error instanceof Error
          ? error.message
          : "Unable to add the page."

    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
