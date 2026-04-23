import { NextResponse } from "next/server"
import { z } from "zod"

import { resolveFigmaPageFromUrl } from "@/lib/figma-registry"

export const runtime = "nodejs"

const bodySchema = z.object({
  url: z.string().url(),
})

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json())
    const resolved = await resolveFigmaPageFromUrl(body.url)
    return NextResponse.json({ ok: true, resolved })
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Invalid payload."
        : error instanceof Error
          ? error.message
          : "Unable to resolve the Figma URL."

    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
