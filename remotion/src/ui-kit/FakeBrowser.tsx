import React from "react";
import { BRAND, FLOAT_SHADOW, FONT, SURFACE, TEXT } from "./theme";

interface FakeBrowserProps {
  /** Address-bar text (no protocol needed, e.g. "leolabs.me/dashboard"). */
  url?: string;
  /** Optional tab title shown left of the address bar. */
  title?: string;
  /** Window width in px. Defaults 1200. */
  width?: number;
  /** Window height in px. Defaults 760. */
  height?: number;
  /** Absolute-position the window; omit both to render in normal flow. */
  x?: number;
  y?: number;
  /** Accent used for the address-bar focus ring / secure dot. */
  accentColor?: string;
  /** Page content — arbitrary JSX rendered inside the viewport. */
  children?: React.ReactNode;
  /** Extra styles merged onto the outer window (e.g. transform overrides). */
  style?: React.CSSProperties;
}

const TRAFFIC = ["#ff5f57", "#febc2e", "#28c840"];

/**
 * FakeBrowser — a re-drawn browser window (NOT a screenshot). Rounded 16,
 * traffic lights, minimal address bar, and a multi-layer float shadow so a
 * designed page floats on the BrandCanvas like a poster. Content is whatever
 * JSX you pass as children; nothing here is a real capture.
 */
export const FakeBrowser: React.FC<FakeBrowserProps> = ({
  url = "leolabs.me",
  title,
  width = 1200,
  height = 760,
  x,
  y,
  accentColor = BRAND.orange,
  children,
  style,
}) => {
  const positioned = x !== undefined || y !== undefined;

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 16,
        overflow: "hidden",
        background: SURFACE.panel,
        boxShadow: FLOAT_SHADOW,
        // 1px inner ring reads crisper than a solid border on dark.
        outline: "1px solid rgba(255,255,255,0.06)",
        outlineOffset: -1,
        display: "flex",
        flexDirection: "column",
        ...(positioned
          ? { position: "absolute", left: x ?? 0, top: y ?? 0 }
          : {}),
        ...style,
      }}
    >
      {/* Chrome / title bar */}
      <div
        style={{
          height: 52,
          flexShrink: 0,
          background: "#252a36",
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "0 20px",
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

        {/* Minimal address bar — pill, secure dot, url text. */}
        <div
          style={{
            flex: 1,
            height: 30,
            borderRadius: 8,
            background: "#171a22",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 14px",
            maxWidth: width * 0.62,
            margin: "0 auto",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: accentColor,
            }}
          />
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 17,
              color: TEXT.mutedDark,
              letterSpacing: "0.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {url}
          </span>
        </div>

        {title && (
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 15,
              color: "#5b6270",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </span>
        )}
      </div>

      {/* Viewport */}
      <div
        style={{
          flex: 1,
          background: SURFACE.light,
          color: TEXT.onLight,
          fontFamily: FONT.sans,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
};
