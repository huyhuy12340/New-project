import { NextResponse } from "next/server"
import { loadIndex } from "@/lib/github"
import { getFigmaImageUrls } from "@/lib/figma-api"
import { writeLocalIndex } from "@/lib/data-store"

export const runtime = "nodejs"

/**
 * GET /api/proxy-image?url=<encoded-url>&entryId=<id>&fileKey=<key>&nodeId=<id>
 *
 * Proxies a Figma image URL. If the URL has expired (returns non-200),
 * it automatically re-fetches a fresh URL from Figma API and updates the index.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const imageUrl = searchParams.get("url")
  const fileKey = searchParams.get("fileKey")
  const nodeId = searchParams.get("nodeId")

  if (!imageUrl) {
    return new NextResponse("Missing url parameter", { status: 400 })
  }

  // Try fetching the stored URL first
  try {
    const response = await fetch(imageUrl, { cache: "no-store" })
    if (response.ok) {
      const contentType = response.headers.get("content-type") ?? "image/jpeg"
      const buffer = await response.arrayBuffer()
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=604800", // 7 days
        },
      })
    }
  } catch {
    // URL likely expired, fall through to refresh
  }

  // URL expired — re-fetch from Figma API if we have the necessary params
  if (!fileKey || !nodeId) {
    return new NextResponse("Image URL expired and cannot be refreshed without fileKey and nodeId", { status: 410 })
  }

  try {
    const freshImages = await getFigmaImageUrls(fileKey, [nodeId], {
      scale: 2,
      format: "png",
    })
    const freshUrl = freshImages[nodeId]
    if (!freshUrl) {
      return new NextResponse("Failed to refresh image from Figma", { status: 502 })
    }

    // Update the stored URL in the index for future requests
    try {
      const index = await loadIndex()
      let updated = false
      for (const entry of index.entries) {
        // Update section-level thumbnail
        if (entry.sectionThumbnail === imageUrl) {
          entry.sectionThumbnail = freshUrl
          updated = true
        }
        // Update frame-level thumbnails
        if (entry.frames) {
          for (const frame of entry.frames) {
            if (frame.thumbnail === imageUrl) {
              frame.thumbnail = freshUrl
              updated = true
            }
          }
        }
      }
      if (updated) {
        await writeLocalIndex(index)
      }
    } catch (err) {
      console.error("Failed to update index with fresh URL:", err)
      // Non-critical: continue serving the image anyway
    }

    // Fetch and proxy the fresh URL
    const freshResponse = await fetch(freshUrl)
    if (!freshResponse.ok) {
      return new NextResponse("Failed to fetch refreshed image", { status: 502 })
    }

    const contentType = freshResponse.headers.get("content-type") ?? "image/jpeg"
    const buffer = await freshResponse.arrayBuffer()
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return new NextResponse(`Proxy error: ${message}`, { status: 500 })
  }
}
