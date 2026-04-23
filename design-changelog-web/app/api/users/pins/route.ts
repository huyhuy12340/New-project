import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { togglePinnedPageId, loadPinnedPageIds, getUserIdFromSession } from "@/lib/user-store"

export const runtime = "nodejs"

const bodySchema = z.object({
  pageId: z.string().min(1),
})

export async function GET() {
  const session = await auth()
  const userId = getUserIdFromSession(session)

  if (!userId) {
    return NextResponse.json({ ok: true, pinnedPageIds: [] })
  }

  const pinnedPageIds = await loadPinnedPageIds(userId)
  return NextResponse.json({ ok: true, pinnedPageIds })
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Sign in to pin pages." }, { status: 401 })
    }

    const body = bodySchema.parse(await request.json())
    const record = await togglePinnedPageId(userId, body.pageId)
    return NextResponse.json({
      ok: true,
      pinned: record.pinnedPageIds.includes(body.pageId),
      pinnedPageIds: record.pinnedPageIds,
    })
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Invalid payload."
        : error instanceof Error
          ? error.message
          : "Unable to update pin."

    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
