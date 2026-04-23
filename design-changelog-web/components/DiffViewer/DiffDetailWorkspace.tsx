"use client"

import * as React from "react"

import type { ChangelogEntry, FrameChange, LayerChange } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ThumbnailCompare } from "@/components/DiffViewer/ThumbnailCompare"
import { LayerDiffList } from "@/components/DiffViewer/LayerDiffList"
import { CanvasOverlay } from "@/components/DiffViewer/CanvasOverlay"
import { Separator } from "@/components/ui/separator"

type DiffDetailWorkspaceProps = {
  entry: ChangelogEntry
}

function selectInitialFrame(frames: FrameChange[]) {
  return frames[0] ?? null
}

function selectInitialLayer(frame: FrameChange | null) {
  return frame?.layers[0] ?? null
}

export function DiffDetailWorkspace({ entry }: DiffDetailWorkspaceProps) {
  const firstFrame = selectInitialFrame(entry.frames)
  const [selectedFrameId, setSelectedFrameId] = React.useState<string | null>(firstFrame?.id ?? null)
  const [selectedLayerId, setSelectedLayerId] = React.useState<string | null>(
    selectInitialLayer(firstFrame)?.id ?? null,
  )

  const selectedFrame = React.useMemo(
    () => entry.frames.find((frame) => frame.id === selectedFrameId) ?? firstFrame ?? null,
    [entry.frames, firstFrame, selectedFrameId],
  )

  const selectedLayer = React.useMemo(() => {
    if (!selectedFrame) {
      return null
    }
    return selectedFrame.layers.find((layer) => layer.id === selectedLayerId) ?? selectedFrame.layers[0] ?? null
  }, [selectedFrame, selectedLayerId])

  const selectedBounds = selectedLayer?.boundingBox ?? selectedFrame?.boundingBox ?? null

  function handleSelectFrame(frame: FrameChange) {
    setSelectedFrameId(frame.id)
    const nextLayer = frame.layers[0] ?? null
    setSelectedLayerId(nextLayer?.id ?? null)
  }

  function handleSelectLayer(frame: FrameChange, layer: LayerChange) {
    setSelectedFrameId(frame.id)
    setSelectedLayerId(layer.id)
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader className="border-b border-border bg-muted/20">
            <CardTitle className="text-lg">Before / After</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-background p-4">
              <ThumbnailCompare
                beforeLabel="Before"
                afterLabel="After"
                beforeSrc={entry.beforeImage || undefined}
                afterSrc={entry.afterImage || undefined}
              />
              <div className="pointer-events-none absolute inset-4">
                <CanvasOverlay bounds={selectedBounds} />
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              {selectedLayer ? (
                <>
                  Selected layer: <span className="font-medium text-foreground">{selectedLayer.name}</span>
                </>
              ) : (
                "Click a frame or layer to inspect its bounds."
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border bg-muted/20">
            <CardTitle className="text-lg">Layer changes</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
              <LayerDiffList
                frames={entry.frames}
                selectedFrameId={selectedFrameId}
                selectedLayerId={selectedLayerId}
                onSelectFrame={handleSelectFrame}
                onSelectLayer={handleSelectLayer}
              />
            </CardContent>
          </Card>
      </section>

      <Separator />
    </div>
  )
}
