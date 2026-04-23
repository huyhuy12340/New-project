"use client"

import * as React from "react"
import { Clock, Layers, ArrowRight, ChevronRight, ListFilter } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { CompareCanvas } from "@/components/CompareCanvas"
import type { ChangelogEntry, FrameChange, LayerChange } from "@/lib/types"

type FrameCompareDialogProps = {
  frameId: string
  currentFrameName: string
  allEntries: ChangelogEntry[]
  figmaFileKey: string
  children: React.ReactNode
}

export function FrameCompareDialog({
  frameId,
  currentFrameName,
  allEntries,
  figmaFileKey,
  children,
}: FrameCompareDialogProps) {
  const [mounted, setMounted] = React.useState(false)
  const [selectedLayerId, setSelectedLayerId] = React.useState<string | undefined>()
  const [mode, setMode] = React.useState<"side-by-side" | "overlay">("side-by-side")

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Find all historical versions of this specific frame
  const history = React.useMemo(() => {
    return allEntries
      .map(entry => {
        const frame = entry.frames?.find(f => f.id === frameId)
        return frame ? { entry, frame } : null
      })
      .filter((h): h is { entry: ChangelogEntry; frame: FrameChange } => h !== null)
      .sort((a, b) => b.entry.lastDetectedAt.localeCompare(a.entry.lastDetectedAt))
  }, [allEntries, frameId])

  const [selectedVersion, setSelectedVersion] = React.useState(history[0])

  React.useEffect(() => {
    if (history.length > 0 && (!selectedVersion || !history.find(h => h.entry.id === selectedVersion.entry.id))) {
      setSelectedVersion(history[0])
    }
  }, [history])

  const layersWithChanges = selectedVersion?.frame.layers.filter(l => l.status !== "pending") ?? []

  // To prevent hydration mismatch while keeping the UI responsive
  if (!mounted) {
    return <div className="block w-full">{children}</div>
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className="block w-full cursor-pointer">
          {children}
        </div>
      </DialogTrigger>
      <DialogContent className="!max-w-[98vw] h-[92vh] p-0 gap-0 overflow-hidden flex flex-col border-none shadow-2xl">
        <DialogHeader className="px-6 py-4 border-b bg-white dark:bg-zinc-950 z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-500/5 rounded-xl">
                 <Layers className="size-5 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  {currentFrameName}
                  <Badge variant="outline" className="font-mono text-[10px] bg-muted/30">
                    {frameId.split(":").pop()}
                  </Badge>
                </DialogTitle>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
                   Figma Node Comparison
                </p>
              </div>
            </div>
            
            {/* Mode Selector */}
            <div className="bg-muted/50 p-1 rounded-xl flex gap-1">
              <button 
                onClick={() => setMode("side-by-side")}
                className={`px-4 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${mode === "side-by-side" ? "bg-white shadow-sm text-blue-600" : "text-muted-foreground hover:text-foreground"}`}
              >
                Side by side
              </button>
              <button 
                onClick={() => setMode("overlay")}
                className={`px-4 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${mode === "overlay" ? "bg-white shadow-sm text-blue-600" : "text-muted-foreground hover:text-foreground"}`}
              >
                Overlay
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden bg-white">
          {/* Left: Snapshot History (Column 1) */}
          <div className="w-72 border-r bg-muted/5 flex flex-col shrink-0">
            <div className="px-4 py-3 border-b bg-muted/10">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-2">
                <Clock className="size-3" />
                Snapshot History
              </h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {history.map((h, i) => (
                  <button
                    key={h.entry.id}
                    onClick={() => {
                      setSelectedVersion(h)
                      setSelectedLayerId(undefined)
                    }}
                    className={`w-full text-left p-4 rounded-2xl transition-all border ${
                      selectedVersion?.entry.id === h.entry.id
                        ? "bg-white shadow-md border-blue-100 ring-1 ring-blue-500/5"
                        : "border-transparent hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-tight ${selectedVersion?.entry.id === h.entry.id ? "text-blue-600" : ""}`}>
                        {i === 0 ? "Latest" : "Previous"}
                      </span>
                      {h.frame.status !== "pending" && (
                        <Badge variant="outline" className={`text-[8px] h-4 px-1.5 leading-none uppercase border-none ${
                          h.frame.status === "added" ? "text-emerald-600 bg-emerald-500/10" :
                          h.frame.status === "edited" ? "text-amber-600 bg-amber-500/10" : "bg-muted"
                        }`}>
                          {h.frame.status}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-foreground" suppressHydrationWarning>
                      {new Date(h.entry.lastDetectedAt).toLocaleString("en-US", {
                        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                      })}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Middle: Canvas (Column 2) */}
          <div className="flex-1 relative bg-[#F5F5F7]">
             {selectedVersion ? (
                <CompareCanvas 
                  frame={selectedVersion.frame}
                  baselineFrame={history[1]?.frame}
                  mode={mode}
                  figmaFileKey={figmaFileKey}
                  selectedLayerId={selectedLayerId}
                  onLayerClick={(l) => setSelectedLayerId(l.id)}
                />
              ) : (
                <div className="flex-1 h-full flex items-center justify-center text-muted-foreground">
                   <div className="text-center">
                      <Layers className="size-10 mx-auto opacity-10 mb-4" />
                      <p className="text-sm font-medium">No snapshot data available.</p>
                   </div>
                </div>
              )}
          </div>

          {/* Right: Layer Changes (Column 3) */}
          <div className="w-72 border-l bg-muted/5 flex flex-col shrink-0">
            <div className="px-4 py-3 border-b bg-muted/10">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-2">
                <ListFilter className="size-3" />
                Layer Changes ({layersWithChanges.length})
              </h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="divide-y divide-border/40">
                {layersWithChanges.length === 0 ? (
                  <div className="p-10 text-center">
                    <div className="size-8 rounded-full bg-muted mx-auto flex items-center justify-center mb-3">
                      <ChevronRight className="size-4 text-muted-foreground/40" />
                    </div>
                    <p className="text-[11px] font-medium text-muted-foreground">No changes detected in this view.</p>
                  </div>
                ) : (
                  layersWithChanges.map((layer) => (
                    <div 
                      key={layer.id}
                      onClick={() => setSelectedLayerId(layer.id)}
                      className={`flex items-start gap-3 p-4 cursor-pointer transition-all ${
                        selectedLayerId === layer.id ? "bg-white shadow-sm ring-1 ring-blue-500/10 border-l-2 border-blue-500" : "hover:bg-muted/30"
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg shrink-0 ${
                        layer.status === "added" ? "bg-emerald-50 text-emerald-600" :
                        layer.status === "removed" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                      }`}>
                        <Layers className="size-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-[13px] truncate leading-tight">{layer.name}</span>
                        </div>
                        <div className="space-y-1.5 mt-2">
                          {layer.changes.map((change, idx) => (
                            <div key={idx} className="bg-muted/50 p-1.5 rounded-md">
                              <div className="text-[8px] font-bold uppercase text-muted-foreground mb-0.5">{change.prop}</div>
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <span className="line-through text-muted-foreground/50 truncate max-w-[80px]">{change.before || "none"}</span>
                                <ArrowRight className="size-2 text-muted-foreground/40 shrink-0" />
                                <span className="text-blue-600 font-bold truncate max-w-[80px]">{change.after}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
