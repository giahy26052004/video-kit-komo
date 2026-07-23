import React from "react";
import { AbsoluteFill } from "remotion";
import { BRAND, SURFACE } from "./theme";

export type BrandCanvasVariant = "dark" | "warm" | "cool" | "spotlight";
export type BrandCanvasOverlay = "none" | "grid" | "noise";

interface BrandCanvasProps {
  /**
   * Gradient tone over the 暖黑 base:
   *   dark      — near-flat base, faintest brand wash (default backdrop)
   *   warm      — 品牌橙 radial from top-right (CTA / hook energy)
   *   cool      — 品牌绿 + 蓝 radial from bottom-left (calm / data mood)
   *   spotlight — centered orange glow (hero字卡 focus)
   */
  variant?: BrandCanvasVariant;
  /** Optional texture layer above the gradient. Defaults "none". */
  overlay?: BrandCanvasOverlay;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

// Faint fractal-noise tile (data URI so it stays self-contained, no assets).
const NOISE_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const gradientFor = (variant: BrandCanvasVariant): string => {
  switch (variant) {
    case "warm":
      return `radial-gradient(ellipse 80% 60% at 82% 12%, ${BRAND.orange}26 0%, transparent 60%), linear-gradient(160deg, ${SURFACE.base} 0%, #0f1116 100%)`;
    case "cool":
      return `radial-gradient(ellipse 75% 65% at 18% 88%, ${BRAND.green}22 0%, transparent 58%), radial-gradient(ellipse 60% 50% at 90% 20%, ${BRAND.blue}1f 0%, transparent 60%), linear-gradient(160deg, ${SURFACE.base} 0%, #0d1015 100%)`;
    case "spotlight":
      return `radial-gradient(ellipse 55% 55% at 50% 46%, ${BRAND.orange}2e 0%, transparent 62%), linear-gradient(180deg, #16191f 0%, #0d0f14 100%)`;
    case "dark":
    default:
      return `radial-gradient(ellipse 90% 70% at 50% 0%, ${BRAND.orange}12 0%, transparent 55%), linear-gradient(180deg, ${SURFACE.base} 0%, #0d0f14 100%)`;
  }
};

/**
 * BrandCanvas — full-bleed branded background board. Every ui-kit scene sits
 * on one of these instead of a flat fill, so the "重绘 UI" look reads as a
 * designed poster rather than a screen recording. Keeps gradients under the
 * design-system's <30% brand-color budget to avoid AI-slop rainbow washes.
 */
export const BrandCanvas: React.FC<BrandCanvasProps> = ({
  variant = "dark",
  overlay = "none",
  children,
  style,
}) => {
  return (
    <AbsoluteFill style={{ background: gradientFor(variant), ...style }}>
      {overlay === "grid" && (
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(${BRAND.ink}0d 1px, transparent 1px), linear-gradient(90deg, ${BRAND.ink}0d 1px, transparent 1px)`,
            backgroundSize: "64px 64px",
            // Fade the grid toward the edges so it never fights the content.
            maskImage:
              "radial-gradient(ellipse 70% 70% at 50% 45%, #000 30%, transparent 78%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 70% 70% at 50% 45%, #000 30%, transparent 78%)",
            pointerEvents: "none",
          }}
        />
      )}
      {overlay === "noise" && (
        <AbsoluteFill
          style={{
            backgroundImage: NOISE_URL,
            opacity: 0.04,
            mixBlendMode: "overlay",
            pointerEvents: "none",
          }}
        />
      )}
      {children}
    </AbsoluteFill>
  );
};
