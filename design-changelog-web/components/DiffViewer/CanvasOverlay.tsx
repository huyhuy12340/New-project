import type { BoundingBox } from "@/lib/types";

type CanvasOverlayProps = {
  bounds?: BoundingBox | null;
};

export function CanvasOverlay({ bounds }: CanvasOverlayProps) {
  if (!bounds) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute rounded-2xl border-2 border-cyan-300/80"
      style={{
        left: bounds.x,
        top: bounds.y,
        width: bounds.w,
        height: bounds.h,
      }}
    />
  );
}
