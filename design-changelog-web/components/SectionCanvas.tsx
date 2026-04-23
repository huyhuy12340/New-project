"use client"

import * as React from "react"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

type SectionCanvasProps = {
  src: string
  alt?: string
  className?: string
}

export function SectionCanvas({ src, alt = "Section preview", className }: SectionCanvasProps) {
  const [imgError, setImgError] = React.useState(false)

  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-muted/30 ${className ?? ""}`}
      style={{ cursor: "grab" }}
    >
      <TransformWrapper
        initialScale={1}
        minScale={0.2}
        maxScale={4}
        centerOnInit
        limitToBounds={false}
        wheel={{ step: 0.08 }}
        doubleClick={{ mode: "reset" }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            {/* Controls */}
            <div className="absolute right-2 top-2 z-10 flex flex-col gap-1">
              <Button
                size="icon"
                variant="secondary"
                className="h-7 w-7 shadow-sm"
                onClick={(e) => { e.stopPropagation(); zoomIn() }}
                title="Zoom in"
              >
                <ZoomIn className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="h-7 w-7 shadow-sm"
                onClick={(e) => { e.stopPropagation(); zoomOut() }}
                title="Zoom out"
              >
                <ZoomOut className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="h-7 w-7 shadow-sm"
                onClick={(e) => { e.stopPropagation(); resetTransform() }}
                title="Reset"
              >
                <RotateCcw className="size-3.5" />
              </Button>
            </div>

            <TransformComponent
              wrapperStyle={{ width: "100%", height: "100%" }}
              contentStyle={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {imgError ? (
                <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
                  <div className="text-3xl">🖼</div>
                  <p className="text-xs">Screenshot unavailable</p>
                  <p className="text-[10px] opacity-60">Run a poll to generate</p>
                </div>
              ) : (
                <img
                  src={src}
                  alt={alt}
                  className="block max-w-none select-none"
                  draggable={false}
                  onError={() => setImgError(true)}
                />
              )}
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  )
}
