"use client"

import type { FrameChange, LayerChange } from "@/lib/types"
import { statusBadgeClassName, statusLabel } from "@/lib/status-badge"
import { Badge } from "@/components/ui/badge"

type LayerDiffListProps = {
  frames: FrameChange[]
  selectedFrameId: string | null
  selectedLayerId: string | null
  onSelectFrame: (frame: FrameChange) => void
  onSelectLayer: (frame: FrameChange, layer: LayerChange) => void
}

export function LayerDiffList({
  frames,
  selectedFrameId,
  selectedLayerId,
  onSelectFrame,
  onSelectLayer,
}: LayerDiffListProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Layer changes</p>
        <h2 className="text-lg font-semibold text-foreground">Diff summary</h2>
      </div>

      <div className="space-y-3">
        {frames.map((frame) => {
          const frameSelected = frame.id === selectedFrameId
          return (
            <div
              key={frame.id}
              className="rounded-2xl border border-border bg-background px-4 py-3"
            >
              <button
                type="button"
                onClick={() => onSelectFrame(frame)}
                className="flex w-full cursor-pointer items-center justify-between gap-3 text-left text-sm font-medium text-foreground transition-colors hover:text-primary"
              >
                <span className="truncate">
                  {frame.name}
                </span>
                <Badge variant="outline" className={statusBadgeClassName(frame.status)}>
                  {statusLabel(frame.status)}
                </Badge>
              </button>

              <div className="mt-3 space-y-2">
                {frame.layers.map((layer) => {
                  const layerSelected = layer.id === selectedLayerId
                  return (
                    <button
                      key={layer.id}
                      type="button"
                      onClick={() => onSelectLayer(frame, layer)}
                      className={[
                        "w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                        layerSelected || frameSelected
                          ? "border-primary/30 bg-primary/5"
                          : "border-border bg-muted/50 hover:border-foreground/30 hover:bg-muted/70",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground">{layer.name}</div>
                          <div className="mt-1 truncate text-xs text-muted-foreground">{layer.path}</div>
                        </div>
                        <Badge variant="outline" className={statusBadgeClassName(layer.status)}>
                          {statusLabel(layer.status)}
                        </Badge>
                      </div>
                      {layer.changes.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {layer.changes.map((change) => (
                            <li key={`${layer.id}-${change.prop}`}>
                              <span className="font-medium text-foreground">{change.prop}</span>{" "}
                              <span className="text-muted-foreground">
                                {String(change.before)} → {String(change.after)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
