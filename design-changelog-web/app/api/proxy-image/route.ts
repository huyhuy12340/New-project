import { NextResponse } from "next/server"
import { readFile, writeFile, mkdir } from "fs/promises"
import path from "path"
import { getFigmaImageUrls } from "@/lib/figma-api"

export const runtime = "nodejs"

function getImageCacheDir() {
  const root = process.env.DATA_REPO_PATH
  if (!root) throw new Error("DATA_REPO_PATH is not set")
  return path.join(path.resolve(root), "data", "images")
}

function getImageCachePath(nodeId: string) {
  // Sanitize nodeId for use as filename (e.g. "123:456" → "123-456")
  const safe = nodeId.replace(/[^a-zA-Z0-9_-]/g, "-")
  return path.join(getImageCacheDir(), `${safe}.png`)
}

/**
 * GET /api/proxy-image?fileKey=<key>&nodeId=<id>
 *
 * 1. Check disk cache → serve instantly if found (permanent, survives restarts)
 * 2. Fetch fresh URL from Figma (retry up to 3× for rate-limits)
 * 3. Download image binary, save to disk, return to browser
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const fileKey = searchParams.get("fileKey")
  const nodeId = searchParams.get("nodeId")

  if (!fileKey || !nodeId) {
    return new NextResponse("Missing fileKey or nodeId", { status: 400 })
  }

  // 1. Serve from disk cache if available
  try {
    const cachePath = getImageCachePath(nodeId)
    const cached = await readFile(cachePath)
    return new NextResponse(cached, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable", // 1 year
        "X-Cache": "HIT",
      },
    })
  } catch {
    // Cache miss — fetch from Figma
  }

  // 2. Fetch from Figma with retry (handles rate-limit null returns)
  let imageUrl: string | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const images = await getFigmaImageUrls(fileKey, [nodeId], {
        scale: 2,
        format: "png",
      })
      imageUrl = images[nodeId] ?? null
      if (imageUrl) break
    } catch {
      // continue
    }
    if (attempt < 2) await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
  }

  if (!imageUrl) {
    return new NextResponse("Figma returned no image for this node", { status: 404 })
  }

  // 3. Download image binary
  const imageResponse = await fetch(imageUrl, { cache: "no-store" })
  if (!imageResponse.ok) {
    return new NextResponse("Failed to fetch image from Figma CDN", { status: 502 })
  }

  const buffer = Buffer.from(await imageResponse.arrayBuffer())

  // 4. Persist to disk cache (fire and forget — don't block the response)
  const cachePath = getImageCachePath(nodeId)
  mkdir(getImageCacheDir(), { recursive: true })
    .then(() => writeFile(cachePath, buffer))
    .catch(err => console.error("[ImageCache] Failed to write cache:", err))

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Cache": "MISS",
    },
  })
}
