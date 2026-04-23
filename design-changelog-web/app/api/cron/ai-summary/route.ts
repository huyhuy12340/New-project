import { NextResponse } from "next/server"

import { loadIndex } from "@/lib/github"
import { writeEntryFile, writeLocalIndex } from "@/lib/data-store"

export const runtime = "nodejs"

function buildSummary(entry: {
  summary: { edited: number; added: number; removed: number }
  frames: Array<{ name: string; layers: Array<{ name: string }> }>
}) {
  const topFrame = entry.frames[0]?.name ?? "the page"
  const topLayerNames = entry.frames
    .flatMap((frame) => frame.layers.slice(0, 2).map((layer) => layer.name))
    .slice(0, 4)

  const changes = [
    entry.summary.edited > 0 ? `${entry.summary.edited} edited` : null,
    entry.summary.added > 0 ? `${entry.summary.added} added` : null,
    entry.summary.removed > 0 ? `${entry.summary.removed} removed` : null,
  ].filter(Boolean)

  const changeText = changes.length > 0 ? changes.join(", ") : "No notable changes"
  const layerText = topLayerNames.length > 0 ? ` Layers touched: ${topLayerNames.join(", ")}.` : ""
  return `${changeText} on ${topFrame}.${layerText}`.trim()
}

export async function GET() {
  try {
    const index = await loadIndex()
    const nextEntries = index.entries.map((entry) =>
      entry.aiSummary?.trim()
        ? entry
        : {
            ...entry,
            aiSummary: buildSummary(entry),
          },
    )

    const nextIndex = {
      ...index,
      entries: nextEntries,
      lastUpdated: new Date().toISOString(),
    }

    await writeLocalIndex(nextIndex)
    await Promise.all(nextEntries.map((entry) => writeEntryFile(entry)))

    return NextResponse.json({
      ok: true,
      updated: nextEntries.filter((entry) => entry.aiSummary?.trim()).length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
