import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export type VideoTheme = "default" | "neon" | "particles";

interface AnimatedBackgroundProps {
  theme: VideoTheme;
  accentColor?: string;
}

/**
 * LƯU Ý: đã thử feTurbulence (SVG noise/grain) nhưng gây TREO hẳn Chromium
 * headless khi render (CPU gần như đứng yên, không tiến triển) — feTurbulence
 * là 1 trong những SVG filter nặng nhất, đặc biệt khi tính lại mỗi frame ở độ
 * phân giải 1080x1920. Đã bỏ hẳn, không dùng SVG filter động trong render nữa.
 */

/** Vệt sáng chéo quét qua khung theo chu kỳ — hiệu ứng "glare"/light beam. */
const LightBeam: React.FC<{ frame: number; durationInFrames: number; color: string }> = ({
  frame,
  durationInFrames,
  color,
}) => {
  const cycle = Math.max(durationInFrames, 1);
  const t = (frame % cycle) / cycle; // 0 -> 1 lặp lại
  const pos = interpolate(t, [0, 1], [-60, 160]);
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(115deg, transparent ${pos - 18}%, ${color}14 ${pos}%, transparent ${pos + 18}%)`,
        pointerEvents: "none",
      }}
    />
  );
};

/**
 * Nền chuyển động dùng chung cho mọi slide trong 1 video, chọn theo `theme`
 * (random mỗi video ở auto_pipeline.mjs) để các video không nhìn giống hệt nhau:
 *   - "default"   → nền tối phẳng (giữ nguyên hành vi cũ, không đổi gì)
 *   - "neon"      → gradient tím-xanh trôi chậm + 2 blob mờ di chuyển + light
 *                   beam quét chéo — cảm giác "tech/cyberpunk"
 *   - "particles" → chấm/đường nối di chuyển nhẹ trên nền tối + light beam nhẹ
 *                   — cảm giác "data/network"
 */
export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({
  theme,
  accentColor = "#22d3ee",
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  if (theme === "neon") {
    const t = interpolate(frame, [0, durationInFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const angle = 135 + Math.sin(t * Math.PI * 2) * 25;
    const x = 50 + Math.sin(t * Math.PI * 2) * 15;
    const y = 50 + Math.cos(t * Math.PI * 2) * 15;
    // 2 blob mờ trôi độc lập, tốc độ/pha khác gradient nền — tạo chiều sâu.
    const blob1X = 30 + Math.sin(frame * 0.012) * 20;
    const blob1Y = 25 + Math.cos(frame * 0.009) * 18;
    const blob2X = 70 + Math.cos(frame * 0.008) * 18;
    const blob2Y = 75 + Math.sin(frame * 0.011) * 15;
    return (
      <AbsoluteFill style={{ background: "#0b0b0f" }}>
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at ${x}% ${y}%, #7c3aed44 0%, transparent 55%),
                         linear-gradient(${angle}deg, #0b0b0f 0%, #1e1040 45%, #0b1a3a 100%)`,
          }}
        />
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at ${100 - x}% ${100 - y}%, ${accentColor}33 0%, transparent 50%)`,
          }}
        />
        {/* Blob 1 — sắc tím, blur mạnh */}
        <div
          style={{
            position: "absolute",
            left: `${blob1X}%`,
            top: `${blob1Y}%`,
            width: width * 0.55,
            height: width * 0.55,
            borderRadius: "50%",
            background: "#a855f7",
            filter: "blur(70px)",
            opacity: 0.22,
            transform: "translate(-50%, -50%)",
          }}
        />
        {/* Blob 2 — theo accentColor, blur mạnh */}
        <div
          style={{
            position: "absolute",
            left: `${blob2X}%`,
            top: `${blob2Y}%`,
            width: width * 0.45,
            height: width * 0.45,
            borderRadius: "50%",
            background: accentColor,
            filter: "blur(65px)",
            opacity: 0.18,
            transform: "translate(-50%, -50%)",
          }}
        />
        <LightBeam frame={frame} durationInFrames={durationInFrames * 2} color={accentColor} />
      </AbsoluteFill>
    );
  }

  if (theme === "particles") {
    const COUNT = 22;
    const dots = Array.from({ length: COUNT }, (_, i) => {
      const seed = i * 137.5; // phân bố đều giả-ngẫu nhiên (golden angle)
      const baseX = ((seed * 3.7) % 100);
      const baseY = ((seed * 5.3) % 100);
      const speed = 0.4 + (i % 5) * 0.15;
      const drift = frame * speed * 0.05;
      const x = (baseX + Math.sin(drift + i) * 6 + 100) % 100;
      const y = (baseY + Math.cos(drift + i * 0.7) * 6 + 100) % 100;
      return { x, y, r: 2 + (i % 3) };
    });
    return (
      <AbsoluteFill style={{ background: "linear-gradient(180deg, #05070d 0%, #0b1220 100%)" }}>
        <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
          {dots.map((d, i) =>
            dots.slice(i + 1, i + 3).map((d2, j) => {
              const dist = Math.hypot(d.x - d2.x, d.y - d2.y);
              if (dist > 28) return null;
              return (
                <line
                  key={`${i}-${j}`}
                  x1={(d.x / 100) * width}
                  y1={(d.y / 100) * height}
                  x2={(d2.x / 100) * width}
                  y2={(d2.y / 100) * height}
                  stroke={accentColor}
                  strokeOpacity={0.12}
                  strokeWidth={1}
                />
              );
            })
          )}
          {dots.map((d, i) => (
            <circle
              key={i}
              cx={(d.x / 100) * width}
              cy={(d.y / 100) * height}
              r={d.r}
              fill={accentColor}
              opacity={0.35}
            />
          ))}
        </svg>
        <LightBeam frame={frame} durationInFrames={durationInFrames * 2.5} color={accentColor} />
      </AbsoluteFill>
    );
  }

  // "default" — không render gì, slide tự vẽ nền phẳng như trước.
  return null;
};
