import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

export type TransitionVariant = "fade" | "zoomBlur" | "slideLeft" | "slideRight" | "pushZoom";
export const TRANSITION_VARIANTS: TransitionVariant[] = ["fade", "zoomBlur", "slideLeft", "slideRight", "pushZoom"];

interface SlideTransitionProps {
  durationInFrames: number;
  /** Kiểu chuyển cảnh — chọn DETERMINISTIC theo index slide ở Root.tsx (không
   * dùng Math.random() ở đây vì component này re-render mỗi frame, random
   * thật sẽ đổi liên tục và làm hỏng animation). */
  variant?: TransitionVariant;
  children: React.ReactNode;
}

/**
 * Chuyển cảnh ở đầu/cuối mỗi slide — thay vì luôn fade đơn giản, mỗi slide
 * dùng 1 trong 5 kiểu (xoay vòng theo index) để video có nhịp điện ảnh hơn:
 * fade, zoom+blur, trượt trái/phải, camera push-in.
 */
export const SlideTransition: React.FC<SlideTransitionProps> = ({
  durationInFrames,
  variant = "fade",
  children,
}) => {
  const frame = useCurrentFrame();
  const fadeFrames = Math.min(10, Math.floor(durationInFrames / 4));
  const t0 = 0;
  const t1 = fadeFrames;
  const t2 = Math.max(fadeFrames + 1, durationInFrames - fadeFrames);
  const t3 = durationInFrames;

  const opacity = interpolate(frame, [t0, t1, t2, t3], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (variant === "zoomBlur") {
    const scale = interpolate(frame, [t0, t1, t2, t3], [0.88, 1, 1, 1.08], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const blur = interpolate(frame, [t0, t1, t2, t3], [10, 0, 0, 10], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return (
      <AbsoluteFill style={{ opacity, transform: `scale(${scale})`, filter: `blur(${blur}px)` }}>
        {children}
      </AbsoluteFill>
    );
  }

  if (variant === "slideLeft" || variant === "slideRight") {
    const dir = variant === "slideLeft" ? 1 : -1;
    const x = interpolate(frame, [t0, t1, t2, t3], [70 * dir, 0, 0, -70 * dir], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return (
      <AbsoluteFill style={{ opacity, transform: `translateX(${x}px)` }}>{children}</AbsoluteFill>
    );
  }

  if (variant === "pushZoom") {
    const scale = interpolate(frame, [t0, t1, t2, t3], [1.18, 1, 1, 0.94], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return <AbsoluteFill style={{ opacity, transform: `scale(${scale})` }}>{children}</AbsoluteFill>;
  }

  // "fade" — mặc định, giữ hành vi cũ.
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};
