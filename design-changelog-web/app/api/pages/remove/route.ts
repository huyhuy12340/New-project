import { NextResponse } from "next/server"
import { z } from "zod"

import { removeTrackedPage } from "@/lib/catalog"

export const runtime = "nodejs"

const bodySchema = z.object({
  pageId: z.string().min(1),
})

export async function DELETE(request: Request) {
  try {
    const body = bodySchema.parse(await request.json())
    const catalog = await removeTrackedPage(body.pageId)

    return NextResponse.json({
      ok: true,
      totalPages: catalog.pages.length,
    })
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Invalid payload."
        : error instanceof Error
          ? error.message
          : "Unable to remove the page."

    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
