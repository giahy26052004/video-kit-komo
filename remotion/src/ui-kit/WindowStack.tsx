import React from "react";
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type WindowStackDirection = "up" | "right" | "left";

interface WindowStackProps {
  /** Windows (usually <FakeBrowser>/<FakeTerminal>) to cascade in, in order. */
  children: React.ReactNode;
  /** Frames between each child's entrance. Defaults 10. */
  stagger?: number;
  /** Frame the first child starts on. Defaults 0. */
  startFrame?: number;
  /** Per-layer cascade offset in px (each child shifts by index × offset). */
  offsetX?: number;
  offsetY?: number;
  /** Direction the windows slide in from. Defaults "up". */
  direction?: WindowStackDirection;
  style?: React.CSSProperties;
}

/**
 * WindowStack — cascades an array of windows in one after another with a spring
 * slide + fade, each layered at a growing offset so they fan out like a stack
 * of designed cards. Later children sit on top (higher zIndex). Centered by
 * default so the whole stack reads as one composed cluster.
 */
export const WindowStack: React.FC<WindowStackProps> = ({
  children,
  stagger = 10,
  startFrame = 0,
  offsetX = 64,
  offsetY = 48,
  direction = "up",
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items = React.Children.toArray(children);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      {items.map((child, i) => {
        const localFrame = frame - startFrame - i * stagger;
        const enter = spring({
          frame: localFrame,
          fps,
          config: { damping: 16, stiffness: 90, mass: 0.8 },
        });

        // Slide distance shrinks to 0 as the spring settles.
        const slide = interpolate(enter, [0, 1], [140, 0]);
        const dx =
          i * offsetX + (direction === "right" ? slide : direction === "left" ? -slide : 0);
        const dy = i * -offsetY + (direction === "up" ? slide : 0);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              zIndex: i,
              opacity: enter,
              transform: `translate(${dx}px, ${dy}px) scale(${interpolate(
                enter,
                [0, 1],
                [0.94, 1],
              )})`,
            }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
};
