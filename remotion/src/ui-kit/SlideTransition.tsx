import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

interface SlideTransitionProps {
  durationInFrames: number;
  children: React.ReactNode;
}

/**
 * Fade nhẹ vào/ra ở đầu-cuối mỗi slide (thay vì cắt cứng giữa các cảnh) —
 * áp dụng chung cho mọi loại slide, không cần đổi logic entrance riêng của
 * từng composition. ~8 frame fade in, ~8 frame fade out (~0.25s @ 30fps).
 */
export const SlideTransition: React.FC<SlideTransitionProps> = ({ durationInFrames, children }) => {
  const frame = useCurrentFrame();
  const fadeFrames = Math.min(8, Math.floor(durationInFrames / 4));
  const opacity = interpolate(
    frame,
    [0, fadeFrames, Math.max(fadeFrames + 1, durationInFrames - fadeFrames), durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};
