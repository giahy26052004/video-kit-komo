import React from "react";
import { useCurrentFrame } from "remotion";
import { BRAND, FLOAT_SHADOW, FONT, SURFACE, TEXT } from "./theme";

export interface TerminalLine {
  text: string;
  /**
   * Frame at which this line STARTS typing. If omitted, lines type
   * sequentially: each starts a few frames after the previous finished.
   */
  delay?: number;
  /** Override text color (e.g. green for output, orange for prompt). */
  color?: string;
  /** Render as a command line with a "$" prompt prefix. Defaults false. */
  prompt?: boolean;
}

interface FakeTerminalProps {
  lines: TerminalLine[];
  /** Title-bar label. Defaults "zsh". */
  title?: string;
  /** Window width in px. Defaults 1000. */
  width?: number;
  /** Window height in px. Defaults 560. */
  height?: number;
  /** Absolute-position; omit both to render in normal flow. */
  x?: number;
  y?: number;
  /**
   * Edge mode — pin to the left screen margin and reveal only the right
   * sliver of the window. Used as the "因果暗示" position (terminal → web)
   * from the reference video, where a terminal edge always hints causality.
   */
  edge?: boolean;
  /** Characters revealed per frame. Defaults 0.8 (~19 chars/sec @ 24fps). */
  charsPerFrame?: number;
  /** Accent for prompt "$" + blinking cursor. */
  accentColor?: string;
  style?: React.CSSProperties;
}

const TRAFFIC = ["#ff5f57", "#febc2e", "#28c840"];
const GAP_FRAMES = 6; // pause between sequential lines

/**
 * FakeTerminal — a re-drawn terminal window with a monospace per-character
 * typewriter. Deep 圆角 body, title bar, traffic lights. Supports `edge` mode
 * that leaves only the right edge on screen for the terminal→browser causal
 * hint the reference video uses. All output is synthetic, never a real capture.
 */
export const FakeTerminal: React.FC<FakeTerminalProps> = ({
  lines,
  title = "zsh",
  width = 1000,
  height = 560,
  x,
  y,
  edge = false,
  charsPerFrame = 0.8,
  accentColor = BRAND.orange,
  style,
}) => {
  const frame = useCurrentFrame();

  // Resolve each line's start frame: explicit delay wins, otherwise chain off
  // the previous line's finish (its start + its full type-out duration + gap).
  const starts: number[] = [];
  let cursor = 0;
  for (let i = 0; i < lines.length; i++) {
    const start = lines[i].delay ?? cursor;
    starts.push(start);
    const typeFrames = Math.ceil(lines[i].text.length / charsPerFrame);
    cursor = start + typeFrames + GAP_FRAMES;
  }

  const positioned = edge || x !== undefined || y !== undefined;
  const edgePlacement: React.CSSProperties = edge
    ? {
        position: "absolute",
        left: 0,
        top: y ?? "12%",
        // Push most of the window off the left edge; keep a ~64px sliver.
        transform: `translateX(-${width - 64}px)`,
      }
    : {};

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 16,
        overflow: "hidden",
        background: SURFACE.terminal,
        boxShadow: FLOAT_SHADOW,
        outline: "1px solid rgba(255,255,255,0.06)",
        outlineOffset: -1,
        display: "flex",
        flexDirection: "column",
        ...(positioned && !edge
          ? { position: "absolute", left: x ?? 0, top: y ?? 0 }
          : {}),
        ...edgePlacement,
        ...style,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          height: 46,
          flexShrink: 0,
          background: "#1a1e26",
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "0 18px",
        }}
      >
        <div style={{ display: "flex", gap: 9 }}>
          {TRAFFIC.map((c) => (
            <div
              key={c}
              style={{
                width: 13,
                height: 13,
                borderRadius: "50%",
                background: c,
              }}
            />
          ))}
        </div>
        <span
          style={{
            flex: 1,
            textAlign: "center",
            fontFamily: FONT.mono,
            fontSize: 15,
            color: "#5b6270",
            letterSpacing: "0.04em",
            marginRight: 40,
          }}
        >
          {title}
        </span>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          padding: "26px 30px",
          fontFamily: FONT.mono,
          fontSize: 26,
          lineHeight: 1.5,
          color: TEXT.onDark,
          overflow: "hidden",
        }}
      >
        {lines.map((line, i) => {
          const start = starts[i];
          const revealed = Math.max(
            0,
            Math.floor((frame - start) * charsPerFrame),
          );
          if (revealed <= 0 && frame < start) return null;

          const shown = line.text.slice(0, revealed);
          const done = revealed >= line.text.length;
          // Cursor sits on the line currently being typed.
          const isActive = frame >= start && !done;

          return (
            <div key={i} style={{ whiteSpace: "pre-wrap", color: line.color }}>
              {line.prompt && (
                <span style={{ color: accentColor, fontWeight: 600 }}>
                  ${" "}
                </span>
              )}
              {shown}
              {isActive && (
                <span
                  style={{
                    display: "inline-block",
                    width: "0.55em",
                    height: "1.05em",
                    marginLeft: 2,
                    background: accentColor,
                    // Blink at ~2Hz.
                    opacity: Math.floor(frame / 6) % 2 === 0 ? 1 : 0.15,
                    transform: "translateY(0.16em)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
