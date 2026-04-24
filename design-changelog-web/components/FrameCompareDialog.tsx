"use client"

import * as React from "react"
import { Layers, ArrowRight, ListFilter, ExternalLink, AlertCircle, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ChangelogEntry, FrameChange, LayerChange } from "@/lib/types"

type FrameCompareDialogProps = {
  frame: FrameChange
  figmaFileKey: string
  figmaUrl?: string
  version?: string  // sync versionId — used to bust the image cache after Sync
  children: React.ReactNode
}

const STATUS_COLOR = {
  added:   { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500", ring: "ring-emerald-500/20", label: "Added",   highlight: "rgba(16,185,129,0.25)", stroke: "#10b981" },
  edited:  { bg: "bg-amber-500/10",   text: "text-amber-600",   border: "border-amber-500",   ring: "ring-amber-500/20",   label: "Edited",   highlight: "rgba(245,158,11,0.25)",  stroke: "#f59e0b" },
  removed: { bg: "bg-red-500/10",     text: "text-red-500",     border: "border-red-500",     ring: "ring-red-500/20",     label: "Removed",  highlight: "rgba(239,68,68,0)",     stroke: "#ef4444" },
  pending: { bg: "bg-muted/20",       text: "text-muted-foreground", border: "border-border", ring: "",                    label: "Pending",  highlight: "transparent",           stroke: "transparent" },
}

// Figma canvas rendered via proxy — on demand, current state
function FigmaCanvas({
  figmaFileKey,
  nodeId,
  layers,
  frameBox,
  version,
  selectedLayerId,
  onLayerClick,
}: {
  figmaFileKey: string
  nodeId: string
  layers: LayerChange[]
  frameBox: { x: number; y: number }
  version?: string
  selectedLayerId: string | undefined
  onLayerClick: (l: LayerChange) => void
}) {
  const [imgSrc, setImgSrc] = React.useState<string | null>(null)
  const [imgError, setImgError] = React.useState(false)
  const [imgLoaded, setImgLoaded] = React.useState(false)
  const [naturalSize, setNaturalSize] = React.useState<{ w: number; h: number } | null>(null)
  const [renderSize, setRenderSize] = React.useState<{ w: number; h: number } | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const imgRef = React.useRef<HTMLImageElement>(null)

  // Build proxy URL
  React.useEffect(() => {
    const v = version ? `&v=${encodeURIComponent(version)}` : ""
    const url = `/api/proxy-image?fileKey=${figmaFileKey}&nodeId=${encodeURIComponent(nodeId)}${v}`
    setImgSrc(url)
    setImgError(false)
    setImgLoaded(false)
    setNaturalSize(null)
    setRenderSize(null)
  }, [figmaFileKey, nodeId])

  // Track rendered image size for overlay scaling
  React.useEffect(() => {
    if (!imgLoaded || !imgRef.current) return
    const img = imgRef.current
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
    const updateSize = () => {
      if (!imgRef.current) return
      setRenderSize({ w: imgRef.current.offsetWidth, h: imgRef.current.offsetHeight })
    }
    updateSize()
    const ro = new ResizeObserver(updateSize)
    ro.observe(img)
    return () => ro.disconnect()
  }, [imgLoaded])

  // Layers that can be highlighted (not removed — they no longer exist on canvas)
  const highlightLayers = layers.filter(l => l.status === "added" || l.status === "edited")

  // Compute scale factors from natural → rendered pixels
  const scaleX = naturalSize && renderSize ? renderSize.w / naturalSize.w : 1
  const scaleY = naturalSize && renderSize ? renderSize.h / naturalSize.h : 1

  return (
    <div ref={containerRef} className="relative w-full h-full flex items-center justify-center bg-[#F5F5F7] overflow-hidden">
      {!imgLoaded && !imgError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground z-10">
          <Loader2 className="size-6 animate-spin opacity-40" />
          <span className="text-xs font-medium opacity-50">Loading from Figma…</span>
        </div>
      )}

      {imgError && (
        <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <AlertCircle className="size-8 opacity-30" />
          <p className="text-sm font-medium opacity-60">Could not load frame</p>
        </div>
      )}

      {imgSrc && !imgError && (
        <div className="relative inline-block">
          <img
            ref={imgRef}
            src={imgSrc}
            alt="Figma frame"
            className="max-h-[calc(92vh-120px)] max-w-full h-auto w-auto object-contain rounded-lg shadow-xl"
            style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 0.3s" }}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />

          {/* Bounding box overlays — filter based on selection */}
          {imgLoaded && renderSize && highlightLayers.map((layer) => {
            const isSelected = selectedLayerId === layer.id
            
            // If a layer is selected, hide all others. If nothing is selected, show all.
            if (selectedLayerId && !isSelected) return null

            const box = layer.boundingBox
            if (!box || (box.w === 0 && box.h === 0)) return null
            const colors = STATUS_COLOR[layer.status] ?? STATUS_COLOR.pending

            const left = (box.x - frameBox.x) * scaleX
            const top  = (box.y - frameBox.y) * scaleY
            const w    = box.w * scaleX
            const h    = box.h * scaleY

            return (
              <div
                key={layer.id}
                onClick={() => onLayerClick(layer)}
                title={layer.name}
                className="absolute cursor-pointer transition-all"
                style={{
                  left, top, width: w, height: h,
                  background: colors.highlight,
                  border: `1.5px solid ${colors.stroke}`,
                  borderRadius: 3,
                  boxShadow: isSelected ? `0 0 0 3px ${colors.stroke}40` : "none",
                  zIndex: isSelected ? 20 : 10,
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

export function FrameCompareDialog({
  frame,
  figmaFileKey,
  figmaUrl,
  version,
  children,
}: FrameCompareDialogProps) {
  const [mounted, setMounted] = React.useState(false)
  const [selectedLayerId, setSelectedLayerId] = React.useState<string | undefined>()

  React.useEffect(() => { setMounted(true) }, [])

  const layersWithChanges = frame.layers.filter(l => l.status !== "pending")

  if (!mounted) {
    return <div className="block w-full">{children}</div>
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className="block w-full cursor-pointer">{children}</div>
      </DialogTrigger>

      <DialogContent className="!max-w-[96vw] h-[92vh] p-0 gap-0 overflow-hidden flex flex-col border-none shadow-2xl">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-background z-20 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/5 rounded-xl">
                <Layers className="size-5 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold leading-tight">
                  {frame.name}
                </DialogTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {layersWithChanges.length} layer change{layersWithChanges.length !== 1 ? "s" : ""} detected
                </p>
              </div>
            </div>

            {figmaUrl && (
              <Button variant="ghost" size="sm" asChild className="gap-1.5 text-xs">
                <a href={figmaUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" />
                  Open in Figma
                </a>
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Canvas */}
          <div className="flex-1 relative overflow-hidden">
            <FigmaCanvas
              figmaFileKey={figmaFileKey}
              nodeId={frame.id}
              layers={frame.layers}
              frameBox={frame.boundingBox}
              version={version}
              selectedLayerId={selectedLayerId}
              onLayerClick={(l) => setSelectedLayerId(prev => prev === l.id ? undefined : l.id)}
            />
          </div>

          {/* Layer Changes Panel */}
          <div className="w-72 border-l bg-muted/5 flex flex-col shrink-0">
            <div className="px-4 py-3 border-b bg-muted/10 shrink-0">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-2">
                <ListFilter className="size-3" />
                Layer Changes ({layersWithChanges.length})
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {layersWithChanges.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="size-8 rounded-full bg-muted mx-auto flex items-center justify-center mb-3">
                    <Layers className="size-4 text-muted-foreground/40" />
                  </div>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    No layer changes detected.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {layersWithChanges.map((layer) => {
                    const colors = STATUS_COLOR[layer.status] ?? STATUS_COLOR.pending
                    const isSelected = selectedLayerId === layer.id
                    const canHighlight = layer.status === "added" || layer.status === "edited"

                    return (
                      <div
                        key={layer.id}
                        onClick={() => {
                          if (canHighlight) {
                            setSelectedLayerId(prev => prev === layer.id ? undefined : layer.id)
                          }
                        }}
                        className={`flex items-start gap-3 p-4 transition-all ${
                          canHighlight ? "cursor-pointer" : "cursor-default"
                        } ${
                          isSelected
                            ? `bg-white dark:bg-zinc-900 shadow-sm border-l-2 ${colors.border}`
                            : canHighlight
                            ? "hover:bg-muted/30"
                            : ""
                        }`}
                      >
                        {/* Status dot */}
                        <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${colors.bg}`}>
                          <Layers className={`size-3.5 ${colors.text}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="font-semibold text-[13px] truncate leading-tight flex-1">
                              {layer.name}
                            </span>
                            <Badge
                              variant="outline"
                              className={`shrink-0 text-[9px] h-4 px-1.5 border-none font-bold uppercase ${colors.bg} ${colors.text}`}
                            >
                              {colors.label}
                            </Badge>
                          </div>

                          {/* Property changes */}
                          {layer.changes.length > 0 && (
                            <div className="space-y-1">
                              {layer.changes.map((change, idx) => (
                                <div key={idx} className="bg-muted/50 p-1.5 rounded-md">
                                  <div className="text-[8px] font-bold uppercase text-muted-foreground mb-0.5">
                                    {change.prop}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[10px]">
                                    <span className="line-through text-muted-foreground/50 truncate max-w-[72px]">
                                      {change.before ?? "none"}
                                    </span>
                                    <ArrowRight className="size-2 text-muted-foreground/40 shrink-0" />
                                    <span className="font-bold truncate max-w-[72px] text-blue-600">
                                      {change.after ?? "—"}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Removed hint */}
                          {layer.status === "removed" && (
                            <p className="text-[10px] text-muted-foreground/60 mt-1 italic">
                              No longer visible on canvas
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
