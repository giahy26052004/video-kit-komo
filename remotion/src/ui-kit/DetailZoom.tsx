import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DetailZoomProps {
  /** Starting frame in canvas coordinates (usually the whole canvas). */
  from: Rect;
  /** Target sub-region to push into (a popup, a button, one row). */
  to: Rect;
  /** Content laid out in canvas coordinates. */
  children: React.ReactNode;
  /** Canvas size; defaults to the composition's width/height. */
  canvasWidth?: number;
  canvasHeight?: number;
  /** Frame the push-in begins. Defaults 8. */
  startFrame?: number;
  style?: React.CSSProperties;
}

/**
 * DetailZoom — pushes from a wide view (`from`) into a specific sub-region
 * (`to`), the "细节特写" move used for privacy popups / shortcuts in the
 * reference video. Computes the transform that frames a rect into the canvas
 * (transformOrigin 0 0), then springs between the two rects so the push-in
 * eases naturally instead of snapping.
 */
export const DetailZoom: React.FC<DetailZoomProps> = ({
  from,
  to,
  children,
  canvasWidth,
  canvasHeight,
  startFrame = 8,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cw = canvasWidth ?? width;
  const ch = canvasHeight ?? height;

  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 18, stiffness: 70, mass: 0.9 },
  });

  const lerp = (a: number, b: number) => a + (b - a) * progress;
  const rx = lerp(from.x, to.x);
  const ry = lerp(from.y, to.y);
  const rw = lerp(from.width, to.width);
  const rh = lerp(from.height, to.height);

  // Fit the current rect into the canvas (contain), then center it.
  const scale = Math.min(cw / rw, ch / rh);
  const tx = cw / 2 - scale * (rx + rw / 2);
  const ty = ch / 2 - scale * (ry + rh / 2);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
        transformOrigin: "0 0",
        willChange: "transform",
        ...style,
      }}
    >
      {children}
    </div>
  );
};
