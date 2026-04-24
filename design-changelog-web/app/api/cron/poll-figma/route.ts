import { NextRequest, NextResponse } from "next/server"
import { syncFigmaSources, syncSinglePage } from "@/lib/figma-sync"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  try {
    // If ?pageId=xxx is passed, sync only that page (fast)
    const pageId = req.nextUrl.searchParams.get("pageId")

    const index = pageId
      ? await syncSinglePage(pageId)
      : await syncFigmaSources()

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
