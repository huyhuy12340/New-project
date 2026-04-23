"use client"

import * as React from "react"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import { FramePreview } from "@/components/FramePreview"
import type { FrameChange, LayerChange, BoundingBox } from "@/lib/types"

type CompareCanvasProps = {
  frame: FrameChange
  baselineFrame?: FrameChange
  mode: "side-by-side" | "overlay"
  figmaFileKey: string
  selectedLayerId?: string
  onLayerClick?: (layer: LayerChange) => void
}

function proxyUrl(fileKey: string, nodeId: string) {
  return `/api/proxy-image?fileKey=${fileKey}&nodeId=${encodeURIComponent(nodeId)}`
}

export function CompareCanvas({
  frame,
  baselineFrame,
  mode,
  figmaFileKey,
  selectedLayerId,
  onLayerClick,
}: CompareCanvasProps) {
  const parentBox = frame.boundingBox

  const renderHighlights = (layers: LayerChange[], isBaseline = false) => {
    return layers
      .filter(l => l.status !== "pending")
      .map(layer => {
        const box = layer.boundingBox
        const top = ((box.y - parentBox.y) / parentBox.h) * 100
        const left = ((box.x - parentBox.x) / parentBox.w) * 100
        const width = (box.w / parentBox.w) * 100
        const height = (box.h / parentBox.h) * 100

        const statusColor = 
          layer.status === "added" ? "border-emerald-500 bg-emerald-500/10" :
          layer.status === "removed" ? "border-red-500 bg-red-500/10" :
          "border-amber-500 bg-amber-500/10"

        const isSelected = selectedLayerId === layer.id

        return (
          <div
            key={`${layer.id}-${isBaseline ? 'old' : 'new'}`}
            className={`absolute border transition-all cursor-pointer group ${statusColor} ${
              isSelected ? "ring-2 ring-white z-20 opacity-100" : "z-10 opacity-40 hover:opacity-100"
            }`}
            style={{
              top: `${top}%`,
              left: `${left}%`,
              width: `${width}%`,
              height: `${height}%`,
            }}
            onClick={(e) => {
              e.stopPropagation()
              onLayerClick?.(layer)
            }}
          >
             {isSelected && (
               <div className="absolute -top-6 left-0 bg-foreground text-background text-[10px] px-1.5 py-0.5 rounded-sm whitespace-nowrap font-medium">
                 {layer.name}
               </div>
             )}
          </div>
        )
      })
  }

  // Always use on-demand proxy — thumbnail field is null, frame.id is the source of truth
  const currentSrc = proxyUrl(figmaFileKey, frame.id)
  const baselineSrc = baselineFrame
    ? proxyUrl(figmaFileKey, baselineFrame.id)
    : currentSrc

  return (
    <div className="w-full h-full bg-[#F5F5F7] overflow-hidden">
      <TransformWrapper
        initialScale={0.8}
        minScale={0.1}
        maxScale={10}
        centerOnInit
        limitToBounds={false}
      >
        <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center p-32">
          <div className="flex gap-16 items-center justify-center min-h-0 min-w-0">
            {/* Side-by-side mode: Two images */}
            {mode === "side-by-side" && (
              <>
                {/* Previous Version */}
                <div className="relative flex flex-col gap-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 text-center">Previous</div>
                  <div className="relative bg-white overflow-hidden rounded-lg">
                    <img 
                      src={baselineSrc}
                      className="max-h-[55vh] w-auto block opacity-40 rounded-lg"
                      alt="Before"
                    />
                    {baselineFrame && renderHighlights(baselineFrame.layers, true)}
                  </div>
                </div>

                {/* Current Version */}
                <div className="relative flex flex-col gap-3">
                  <div className="flex items-center justify-center gap-2">
                    <div className="relative flex size-2 items-center justify-center">
                      <div className="absolute size-full rounded-full bg-blue-500 animate-ping opacity-75" />
                      <div className="relative size-1.5 rounded-full bg-blue-500" />
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-blue-500 text-center">Current</div>
                  </div>
                  <div className="relative bg-white overflow-hidden rounded-lg">
                    <img 
                      src={currentSrc}
                      className="max-h-[55vh] w-auto block rounded-lg"
                      alt="After"
                    />
                    {renderHighlights(frame.layers)}
                  </div>
                </div>
              </>
            )}

            {/* Overlay mode */}
            {mode === "overlay" && (
              <div className="relative flex flex-col gap-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 text-center italic">Overlay Mode (Coming Soon)</div>
                <div className="relative bg-black shadow-2xl overflow-hidden">
                   <img src={currentSrc} className="max-h-[60vh] w-auto block" alt="Current" />
                </div>
              </div>
            )}
          </div>
        </TransformComponent>
      </TransformWrapper>
    </div>
  )
}
