/**
 * ui-kit shared theme — Leo Labs brand palette.
 *
 * These are the ONLY colors the ui-kit components reach for. They mirror
 * ~/.claude/design-system.md so the "重绘 UI" look stays on-brand and never
 * drifts into the Anthropic 米色 (#F0EEE5) palette the reference video used.
 */

export const BRAND = {
  /** 品牌橙 — action / CTA / highlight / accent glow. */
  orange: "#ee943e",
  /** 品牌绿 — identity / positive state / brand mark. */
  green: "#4fae50",
  /** 品牌蓝 — info / data / links / chart secondary. */
  blue: "#1060b0",
  /** 品牌金 — achievement / special marker (use sparingly). */
  gold: "#f0c040",
  /** Structural ink for light-surface text/borders. */
  ink: "#111827",
} as const;

/**
 * Dark canvas ramp — 暖黑 base (not pure black), matching the video cover
 * template's #14171f so ui-kit scenes sit next to existing slides cleanly.
 */
export const SURFACE = {
  /** Base暖黑 background. */
  base: "#14171f",
  /** Slightly lifted panel (browser chrome, cards). */
  panel: "#1c202b",
  /** Terminal body — deeper than base for contrast. */
  terminal: "#0f1218",
  /** Light content surface inside a FakeBrowser page. */
  light: "#ffffff",
  /** Muted light-surface background. */
  lightMuted: "#f3f4f6",
} as const;

export const TEXT = {
  /** Primary on dark. */
  onDark: "#f5f6f8",
  /** Secondary on dark. */
  mutedDark: "#9ca3af",
  /** Primary on light. */
  onLight: "#111827",
  /** Secondary on light. */
  mutedLight: "#6b7280",
} as const;

export const FONT = {
  sans: "'Inter', -apple-system, 'PingFang SC', sans-serif",
  mono: "'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace",
} as const;

/**
 * Multi-layer shadow that gives floating windows the "expensive poster" depth
 * the reference video leans on. Ambient + key + contact layers.
 */
export const FLOAT_SHADOW =
  "0 2px 4px rgba(0,0,0,0.28), 0 12px 28px rgba(0,0,0,0.42), 0 48px 90px -24px rgba(0,0,0,0.6)";
