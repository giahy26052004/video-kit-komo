import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

export interface CameraKeyframe {
  /** Timeline frame (relative to the component's sequence) for this pose. */
  frame: number;
  /** Translate applied to content in px. Positive x pans content right. */
  x?: number;
  y?: number;
  /** Zoom. 1 = neutral, >1 pushes in. */
  scale?: number;
}

interface CameraRigProps {
  /** Ordered keyframes (≥1). Frames must be non-decreasing. */
  keyframes: CameraKeyframe[];
  /** Origin for the zoom. Defaults "50% 50%". */
  origin?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

// Smooth ease for pan/zoom so moves feel like a camera, not a linear tween.
const EASE = Easing.bezier(0.4, 0, 0.2, 1);

/**
 * CameraRig — wraps content and moves a virtual camera across keyframes to
 * replace hard cuts with smooth pan/zoom. Each of x/y/scale is interpolated
 * over the keyframe frames with an ease, clamped outside the range so the
 * first/last pose holds. This is the "运镜代替剪辑" primitive from the spec.
 */
export const CameraRig: React.FC<CameraRigProps> = ({
  keyframes,
  origin = "50% 50%",
  children,
  style,
}) => {
  const frame = useCurrentFrame();

  // Single keyframe → static pose (interpolate needs ≥2 stops).
  const frames = keyframes.map((k) => k.frame);
  const single = keyframes.length < 2;

  const sample = (pick: (k: CameraKeyframe) => number, fallback: number) => {
    if (single) return keyframes[0] ? pick(keyframes[0]) : fallback;
    const values = keyframes.map((k) => pick(k) ?? fallback);
    return interpolate(frame, frames, values, {
      easing: EASE,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  };

  const x = sample((k) => k.x ?? 0, 0);
  const y = sample((k) => k.y ?? 0, 0);
  const scale = sample((k) => k.scale ?? 1, 1);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: `translate(${x}px, ${y}px) scale(${scale})`,
        transformOrigin: origin,
        willChange: "transform",
        ...style,
      }}
    >
      {children}
    </div>
  );
};
