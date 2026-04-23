import { NextResponse } from "next/server"

import { syncFigmaSources } from "@/lib/figma-sync"

export const runtime = "nodejs"

export async function GET() {
  try {
    const index = await syncFigmaSources()
    return NextResponse.json({
      ok: true,
      lastUpdated: index.lastUpdated,
      entryCount: index.entries.length,
      sourceCount: index.sources.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
