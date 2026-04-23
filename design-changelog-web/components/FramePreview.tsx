"use client"

import * as React from "react"
import { Layers } from "lucide-react"

type FramePreviewProps = {
  src: string
  alt?: string
  className?: string
}

export function FramePreview({ src, alt = "Frame preview", className }: FramePreviewProps) {
  const [imgError, setImgError] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)
  const [retryCount, setRetryCount] = React.useState(0)
  const [currentSrc, setCurrentSrc] = React.useState(src)

  const handleError = React.useCallback(() => {
    if (retryCount < 3) {
      const nextRetry = retryCount + 1
      // Exponential back-off: 2s, 4s, 6s
      setTimeout(() => {
        setRetryCount(nextRetry)
        setLoaded(false)
        setCurrentSrc(`${src}${src.includes("?") ? "&" : "?"}retry=${nextRetry}`)
      }, nextRetry * 2000)
    } else {
      setImgError(true)
    }
  }, [retryCount, src])

  return (
    <div
      className={`relative overflow-hidden bg-[#F5F5F5] dark:bg-[#1c1c1e] p-8 flex items-center justify-center transition-colors duration-200 hover:bg-[#EEEEEE] dark:hover:bg-[#2c2c2e] ${className ?? ""}`}
    >
      {imgError ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
          <Layers className="size-6 opacity-30" />
          <p className="text-[10px] opacity-60">Screenshot unavailable</p>
        </div>
      ) : (
        <>
          {/* Skeleton while loading */}
          {!loaded && (
            <div className="absolute inset-0 animate-pulse bg-muted/30" />
          )}
          <img
            src={currentSrc}
            alt={alt}
            className="max-h-full max-w-full h-auto w-auto object-contain transition-opacity duration-300 rounded-lg"
            style={{
              opacity: loaded ? 1 : 0,
              imageRendering: "-webkit-optimize-contrast",
            }}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={handleError}
          />
        </>
      )}
    </div>
  )
}
