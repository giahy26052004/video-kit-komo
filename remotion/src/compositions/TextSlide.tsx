import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AnimatedBackground, VideoTheme } from "../ui-kit/AnimatedBackground";
import { FitMedia, MediaKind } from "../ui-kit/FitMedia";

type Caption = { from: number; to: number; text: string };

export type TextSlideMode = "default" | "hero";
/** Layout template — chọn ngẫu nhiên mỗi video ở auto_pipeline.mjs, độc lập với `theme`. */
export type TextSlideTemplate = "screen" | "banner" | "poster";

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
  /** Layout template — "screen" (mặc định, ảnh mờ nền nhẹ) | "banner" (ảnh rõ + khối chữ nghiêng dạng ribbon) | "poster" (ảnh full-bleed kịch tính + chữ khổng lồ). */
  template?: TextSlideTemplate;
  /** Ảnh minh hoạ thật (screenshot) — MỌI slide đều cần có ảnh/video minh hoạ, kể cả slide text/bullet. Cũng dùng làm poster fallback khi mediaType="video" lỗi. */
  imageSrc?: string;
  /** "image" (mặc định) hoặc "video". */
  mediaType?: MediaKind;
  /** Video minh hoạ thật — chỉ dùng khi mediaType === "video". */
  videoSrc?: string;
  mediaDurationSeconds?: number;
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
  template = "screen",
  imageSrc,
  mediaType = "image",
  videoSrc,
  mediaDurationSeconds,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  // Captions are rendered globally by CaptionsLayer at the Root level for
  // consistent styling across all slide types; no per-slide caption render here.
  void captions;
  const hasMedia = Boolean(imageSrc);
  const isVideo = mediaType === "video" && Boolean(videoSrc);
  const mediaSrc = isVideo ? videoSrc! : imageSrc;
  const videoProps =
    isVideo && mediaDurationSeconds
      ? mediaDurationSeconds * fps < durationInFrames
        ? { loopDurationInFrames: Math.max(1, Math.round(mediaDurationSeconds * fps)) }
        : { trimAfter: durationInFrames }
      : undefined;
  // Giống ImageSlide: ảnh chụp màn hình web luôn ngang (16:9-16:10) — "contain"
  // vào khung dọc sẽ bị thu nhỏ nặng, chữ không đọc được. Video B-roll thật đã
  // gần khớp tỉ lệ dọc nên giữ "contain" full vùng như cũ.
  const screenshotBoxHeightPct = Math.min(78, ((width * 0.625) / height) * 100);

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

  // "screen" (mặc định) — layout cũ gần như nguyên vẹn, ảnh (nếu có) chỉ làm
  // nền mờ phía sau cho có minh hoạ thật mà không phá nhịp chữ giữa khung.
  if (template === "screen") {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: theme === "default" && !hasMedia ? "#0b0b0f" : "transparent",
          alignItems: "center",
          justifyContent: "center",
          padding: 80,
          transform: `scale(${kenBurnsScale})`,
          transformOrigin: "center",
        }}
      >
        {/* Ảnh/video thật (nếu có) LÀ nền — AnimatedBackground (nền giả) chỉ dùng khi
            không có media, vì 2 lớp vẽ đè lên nhau sẽ che mất media thật phía dưới. */}
        {hasMedia ? (
          <>
            <FitMedia
              src={mediaSrc!}
              kind={mediaType}
              videoProps={videoProps}
              posterSrc={imageSrc}
              filter="blur(8px) brightness(0.45)"
            />
            <AbsoluteFill style={{ background: "rgba(11,11,15,0.35)" }} />
          </>
        ) : (
          theme !== "default" && <AnimatedBackground theme={theme} accentColor={accentColor} />
        )}
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
  }

  if (template === "banner") {
    // banner — ảnh thật rõ nét phía trên, khối chữ nằm trong "ribbon" nghiêng
    // màu accent phía dưới, giống ImageSlide mode="banner" cho đồng bộ cả bộ.
    const ribbonSkew = interpolate(frame, [0, 15], [-6, -2], { extrapolateRight: "clamp" });
    const ribbonX = interpolate(heroSpring, [0, 1], [-120, 0]);
    return (
      <AbsoluteFill style={{ background: "#0b0b0f" }}>
        {hasMedia ? (
          <>
            <FitMedia
              src={mediaSrc!}
              kind={isVideo ? "video" : "image"}
              videoProps={videoProps}
              posterSrc={imageSrc}
              contentArea={{ top: 0, left: 0, width: "100%", height: isVideo ? "78%" : `${screenshotBoxHeightPct}%` }}
              fit={isVideo ? "contain" : "cover"}
              transform={`scale(${kenBurnsScale})`}
            />
            <AbsoluteFill
              style={{
                background: isVideo
                  ? "linear-gradient(180deg, transparent 55%, #0b0b0f 92%)"
                  : `linear-gradient(180deg, transparent ${Math.max(0, screenshotBoxHeightPct - 5)}%, #0b0b0f 85%)`,
              }}
            />
          </>
        ) : (
          theme !== "default" && <AnimatedBackground theme={theme} accentColor={accentColor} />
        )}
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 130, padding: "0 60px 130px" }}>
          <div
            style={{
              display: "inline-block",
              background: `linear-gradient(90deg, ${accentColor}, ${accentColor}cc)`,
              padding: "26px 34px",
              borderRadius: 16,
              transform: `skewY(${ribbonSkew}deg) translateX(${ribbonX}px)`,
              boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
              maxWidth: "100%",
            }}
          >
            <div
              style={{
                transform: `skewY(${-ribbonSkew}deg)`,
                fontSize: textFont * 0.62,
                fontWeight: 800,
                color: "#0b0b0f",
                lineHeight: 1.25,
                whiteSpace: "pre-line",
                fontFamily: "-apple-system, Inter, sans-serif",
                letterSpacing: "-0.02em",
              }}
            >
              {displayedText}
            </div>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // "poster" — ảnh full-bleed kịch tính + chữ khổng lồ xoay/nghiêng nhẹ giữa khung.
  const posterRotate = interpolate(frame, [0, durationInFrames], [-3, -1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {hasMedia ? (
        <>
          <FitMedia
            src={mediaSrc!}
            kind={isVideo ? "video" : "image"}
            videoProps={videoProps}
            posterSrc={imageSrc}
            contentArea={isVideo ? undefined : { top: 0, left: 0, width: "100%", height: `${screenshotBoxHeightPct}%` }}
            fit={isVideo ? "contain" : "cover"}
            transform={`scale(${kenBurnsScale})`}
            filter="saturate(1.1)"
          />
          <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.7) 45%, rgba(0,0,0,0.85) 70%, rgba(0,0,0,0.95) 100%)` }} />
        </>
      ) : (
        theme !== "default" && <AnimatedBackground theme={theme} accentColor={accentColor} />
      )}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
        <div
          style={{
            position: "relative",
            fontSize: textFont * 0.9,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.2,
            textAlign: "center",
            maxWidth: 950,
            whiteSpace: "pre-line",
            fontFamily: "-apple-system, Inter, sans-serif",
            letterSpacing: "-0.02em",
            opacity: heroOpacity,
            transform: `${heroTransform === "none" ? "" : heroTransform + " "}skewY(-2deg) rotate(${posterRotate}deg)`,
            textShadow: `0 0 70px ${accentColor}88, 0 10px 40px rgba(0,0,0,0.8)`,
          }}
        >
          {displayedText}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
