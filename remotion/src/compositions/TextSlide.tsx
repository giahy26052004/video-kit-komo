import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AnimatedBackground, VideoTheme } from "../ui-kit/AnimatedBackground";

type Caption = { from: number; to: number; text: string };

export type TextSlideMode = "default" | "hero";

interface TextSlideProps {
  text: string;
  captions?: Caption[];
  /**
   * "default" → balanced single-text slide (legacy behavior).
   * "hero"    → big-font hook moment occupying ~60-70% of canvas height,
   *             with spring entrance + optional typewriter reveal.
   */
  mode?: TextSlideMode;
  /** Optional reveal style for hero mode. Default "spring". */
  reveal?: "spring" | "typewriter";
  /** Multiplier for all font sizes (driven by preset). */
  fontScale?: number;
  /** Override accent color used for caption pill / hero glow. */
  accentColor?: string;
  /** Nền động dùng chung cho cả video. "default" = giữ nguyên nền phẳng cũ. */
  theme?: VideoTheme;
}

/**
 * Text-only slide. In hero mode, the text becomes the dominant visual element
 * (big font, spring/typewriter reveal, subtle KenBurns) — built for shorts
 * "hook" moments where one sentence has to land in the first 1-2s.
 */
export const TextSlide: React.FC<TextSlideProps> = ({
  text,
  captions,
  mode = "default",
  reveal = "spring",
  fontScale = 1,
  accentColor = "#f59e0b",
  theme = "default",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  // Captions are rendered globally by CaptionsLayer at the Root level for
  // consistent styling across all slide types; no per-slide caption render here.
  void captions;

  const isHero = mode === "hero";
  // Default base font: 72 (legacy). Hero amplifies via fontScale × 1.5.
  const baseFont = isHero ? 96 : 72;
  // Bullet-style multi-line text (vd release highlights "title\n✅ a\n✅ b\n✅ c")
  // tràn khung/đè caption nếu giữ nguyên cỡ chữ mặc định — tự co lại theo số dòng.
  const lineCount = text.split("\n").filter(Boolean).length;
  const autoShrink = isHero ? 1 : Math.max(0.5, 1 - Math.max(0, lineCount - 1) * 0.15);
  const textFont = baseFont * fontScale * autoShrink;

  // KenBurns: subtle 1.0 → 1.04 zoom across the slide for "alive" feel.
  const kenBurnsScale = interpolate(frame, [0, durationInFrames], [1.0, 1.04], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Spring entrance for hero mode (default mode keeps legacy static feel).
  const heroSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.6 },
  });

  // Typewriter: reveal 1 char per ~1.5 frames (≈20 chars/sec @ 30fps).
  const typewriterChars = Math.floor(frame / 1.5);
  const displayedText =
    isHero && reveal === "typewriter" ? text.slice(0, typewriterChars) : text;

  const heroOpacity = isHero ? (reveal === "typewriter" ? 1 : heroSpring) : 1;
  const heroTransform = isHero
    ? reveal === "spring"
      ? `scale(${0.92 + heroSpring * 0.08}) translateY(${interpolate(heroSpring, [0, 1], [16, 0])}px)`
      : "none"
    : "none";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme === "default" ? "#0b0b0f" : "transparent",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
        transform: `scale(${kenBurnsScale})`,
        transformOrigin: "center",
      }}
    >
      {theme !== "default" && <AnimatedBackground theme={theme} accentColor={accentColor} />}
      {isHero && (
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: "60%",
            background: `radial-gradient(ellipse at center, ${accentColor}22 0%, transparent 65%)`,
            filter: "blur(50px)",
            pointerEvents: "none",
          }}
        />
      )}

      <div
        style={{
          position: "relative",
          fontSize: textFont,
          fontWeight: isHero ? 800 : 600,
          color: "#fff",
          lineHeight: isHero ? 1.15 : 1.3,
          textAlign: "center",
          maxWidth: isHero ? 1000 : 900,
          whiteSpace: "pre-line",
          fontFamily: "-apple-system, Inter, sans-serif",
          letterSpacing: isHero ? "-0.03em" : "normal",
          opacity: heroOpacity,
          transform: heroTransform,
          textShadow: isHero ? `0 0 80px ${accentColor}55` : "none",
        }}
      >
        {displayedText}
      </div>
    </AbsoluteFill>
  );
};
