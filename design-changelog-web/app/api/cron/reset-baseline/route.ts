import { NextResponse } from "next/server"

import { resetFigmaBaselines } from "@/lib/figma-sync"

export const runtime = "nodejs"

export async function GET() {
  try {
    await resetFigmaBaselines()
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
