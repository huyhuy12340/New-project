import { NextResponse } from "next/server"
import { getFigmaImageUrls } from "@/lib/figma-api"

export const runtime = "nodejs"

// ---------------------------------------------------------------------------
// In-memory image cache (module-level, survives across requests in dev/prod)
// Key: `${fileKey}:${nodeId}`  Value: { buffer, contentType, cachedAt }
// ---------------------------------------------------------------------------
const memCache = new Map<string, { buffer: Buffer; contentType: string; cachedAt: number }>()
const CACHE_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours

function getCached(key: string) {
  const entry = memCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    memCache.delete(key)
    return null
  }
  return entry
}

/**
 * GET /api/proxy-image?fileKey=<key>&nodeId=<id>
 *
 * 1. Memory cache HIT  → return instantly (~0ms, no network)
 * 2. Memory cache MISS → fetch JPEG from Figma (scale:1, ~30-60 KB)
 *                      → store in memory → return
 *
 * No disk I/O. No database. Cache lives as long as the server process.
 * Images are ~70-80% smaller than PNG because we use JPEG format.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const fileKey = searchParams.get("fileKey")
  const nodeId = searchParams.get("nodeId")

  if (!fileKey || !nodeId) {
    return new NextResponse("Missing fileKey or nodeId", { status: 400 })
  }

  const cacheKey = `${fileKey}:${nodeId}`

  // 1. Serve from memory cache
  const cached = getCached(cacheKey)
  if (cached) {
    return new NextResponse(cached.buffer, {
      headers: {
        "Content-Type": cached.contentType,
        "Cache-Control": "public, max-age=7200, stale-while-revalidate=86400",
        "X-Cache": "HIT",
      },
    })
  }

  // 2. Fetch from Figma — JPEG at scale:1 ≈ 30-60 KB per frame
  let imageUrl: string | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const images = await getFigmaImageUrls(fileKey, [nodeId], {
        scale: 1,
        format: "jpg", // JPEG: ~70-80% smaller than PNG
      })
      imageUrl = images[nodeId] ?? null
      if (imageUrl) break
    } catch { /* retry */ }
    if (attempt < 2) await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
  }

  if (!imageUrl) {
    return new NextResponse("Figma returned no image for this node", { status: 404 })
  }

  const imageResponse = await fetch(imageUrl, { cache: "no-store" })
  if (!imageResponse.ok) {
    return new NextResponse("Failed to fetch from Figma CDN", { status: 502 })
  }

  const contentType = imageResponse.headers.get("content-type") ?? "image/jpeg"
  const buffer = Buffer.from(await imageResponse.arrayBuffer())

  // Store in memory cache (fire-and-forget, non-blocking)
  memCache.set(cacheKey, { buffer, contentType, cachedAt: Date.now() })

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=7200, stale-while-revalidate=86400",
      "X-Cache": "MISS",
    },
  })
}
