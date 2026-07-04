import React from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BrandCanvas } from "./BrandCanvas";
import { CameraRig } from "./CameraRig";
import { DetailZoom } from "./DetailZoom";
import { FakeBrowser } from "./FakeBrowser";
import { FakeTerminal } from "./FakeTerminal";
import { WindowStack } from "./WindowStack";
import { BRAND, FONT, TEXT } from "./theme";

/**
 * UiKitDemo — 30s reference reel that exercises all six ui-kit components on
 * synthetic content (no real captures). Structure mirrors the faceless
 * ClaudeDevs skeleton from the spec:
 *   hook (terminal) → browser slide-in → window cascade → detail zoom → 字卡.
 *
 * Registered as composition id="UiKitDemo" (1920×1080, 24fps, 720 frames).
 */

// ---- synthetic content pieces -------------------------------------------

const StatTile: React.FC<{ label: string; value: string; color: string }> = ({
  label,
  value,
  color,
}) => (
  <div
    style={{
      flex: 1,
      background: "#f9fafb",
      borderRadius: 14,
      padding: "22px 26px",
      outline: "1px solid rgba(17,24,39,0.06)",
    }}
  >
    <div
      style={{
        fontFamily: FONT.mono,
        fontSize: 15,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: TEXT.mutedLight,
      }}
    >
      {label}
    </div>
    <div
      style={{
        marginTop: 8,
        fontSize: 44,
        fontWeight: 700,
        letterSpacing: "-0.02em",
        color,
      }}
    >
      {value}
    </div>
  </div>
);

const FakeDashboard: React.FC = () => {
  const bars = [42, 68, 55, 80, 63, 91, 74];
  return (
    <div style={{ padding: 40, height: "100%", boxSizing: "border-box" }}>
      <div
        style={{
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: TEXT.onLight,
        }}
      >
        Signal Dashboard
      </div>
      <div style={{ display: "flex", gap: 18, marginTop: 26 }}>
        <StatTile label="Win rate" value="63%" color={BRAND.green} />
        <StatTile label="Edge" value="+8.4%" color={BRAND.orange} />
        <StatTile label="Signals" value="1,204" color={BRAND.blue} />
      </div>
      {/* Bar chart placeholder — synthetic, brand-green bars. */}
      <div
        style={{
          marginTop: 30,
          height: 220,
          display: "flex",
          alignItems: "flex-end",
          gap: 22,
          padding: "0 8px",
        }}
      >
        {bars.map((h, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${h}%`,
              borderRadius: "8px 8px 0 0",
              background:
                i === 5
                  ? BRAND.orange
                  : `linear-gradient(180deg, ${BRAND.green} 0%, ${BRAND.green}99 100%)`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

const FakeScenePage: React.FC<{ tag: string; title: string; body: string }> = ({
  tag,
  title,
  body,
}) => (
  <div style={{ padding: 34 }}>
    <div
      style={{
        display: "inline-block",
        fontFamily: FONT.mono,
        fontSize: 14,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: BRAND.orange,
        background: `${BRAND.orange}1a`,
        padding: "5px 12px",
        borderRadius: 999,
      }}
    >
      {tag}
    </div>
    <div
      style={{
        marginTop: 18,
        fontSize: 30,
        fontWeight: 700,
        letterSpacing: "-0.02em",
        color: TEXT.onLight,
      }}
    >
      {title}
    </div>
    <div
      style={{
        marginTop: 12,
        fontSize: 20,
        lineHeight: 1.5,
        color: TEXT.mutedLight,
        maxWidth: "44ch",
      }}
    >
      {body}
    </div>
  </div>
);

// ---- scenes -------------------------------------------------------------

/** Scene 1 — hook: terminal types a command under a big conclusion字幕. */
const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const captionOpacity = interpolate(frame, [40, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <BrandCanvas variant="warm" overlay="grid">
      <AbsoluteFill
        style={{ alignItems: "center", justifyContent: "center", gap: 56 }}
      >
        <FakeTerminal
          width={1080}
          height={360}
          title="claude-video-kit"
          lines={[
            { text: "kit render script.md", prompt: true },
            { text: "✓ rendered 30s in one pass", delay: 34, color: BRAND.green },
          ]}
        />
        <div
          style={{
            opacity: captionOpacity,
            fontFamily: FONT.sans,
            fontSize: 58,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: TEXT.onDark,
            textAlign: "center",
          }}
        >
          一份脚本，一条<span style={{ color: BRAND.orange }}>成片</span>。
        </div>
      </AbsoluteFill>
    </BrandCanvas>
  );
};

/** Scene 2 — browser slides in; terminal edge hints causality from the left. */
const BrowserScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame: frame - 6,
    fps,
    config: { damping: 16, stiffness: 78, mass: 0.9 },
  });
  const ty = interpolate(enter, [0, 1], [140, 0]);
  return (
    <BrandCanvas variant="dark" overlay="grid">
      {/* Left-edge terminal — the 因果暗示 position. */}
      <FakeTerminal
        edge
        height={620}
        lines={[{ text: "watching signals…", prompt: true, color: BRAND.green }]}
      />
      {/* Subtle push-in on the whole scene while the browser settles. */}
      <CameraRig
        keyframes={[
          { frame: 0, scale: 1.04 },
          { frame: 80, scale: 1.0 },
        ]}
      >
        <AbsoluteFill
          style={{ alignItems: "center", justifyContent: "center" }}
        >
          <div style={{ transform: `translateY(${ty}px)`, opacity: enter }}>
            <FakeBrowser
              url="leolabs.me/dashboard"
              title="Signals"
              width={1280}
              height={720}
            >
              <FakeDashboard />
            </FakeBrowser>
          </div>
        </AbsoluteFill>
      </CameraRig>
    </BrandCanvas>
  );
};

/** Scene 3 — three fake scene-pages cascade in as a window stack. */
const StackScene: React.FC = () => (
  <BrandCanvas variant="cool" overlay="noise">
    <WindowStack stagger={12} startFrame={4} offsetX={80} offsetY={54}>
      <FakeBrowser url="leolabs.me/pr" title="PR walkthrough" width={980} height={600}>
        <FakeScenePage
          tag="场景 01"
          title="PR Walkthrough"
          body="逐块高亮 diff，旁白讲到哪一行，画面就推到哪一行。"
        />
      </FakeBrowser>
      <FakeBrowser url="leolabs.me/arch" title="Architecture" width={980} height={600}>
        <FakeScenePage
          tag="场景 02"
          title="架构图"
          body="节点依次连线，系统关系不用嘴说，画面自己讲清楚。"
        />
      </FakeBrowser>
      <FakeBrowser url="leolabs.me/metrics" title="Dashboard" width={980} height={600}>
        <FakeScenePage
          tag="场景 03"
          title="实时看板"
          body="一个精心设计的假例子，比真录屏更干净、更像海报。"
        />
      </FakeBrowser>
    </WindowStack>
  </BrandCanvas>
);

/** Scene 4 — push into a privacy popup with DetailZoom. */
const ZoomScene: React.FC = () => (
  <BrandCanvas variant="dark" overlay="grid">
    <DetailZoom
      from={{ x: 0, y: 0, width: 1920, height: 1080 }}
      to={{ x: 700, y: 380, width: 640, height: 360 }}
      startFrame={10}
    >
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <FakeBrowser url="leolabs.me/settings" width={1280} height={720}>
          <div
            style={{
              position: "relative",
              height: "100%",
              filter: "saturate(0.6)",
              opacity: 0.5,
            }}
          >
            <FakeDashboard />
          </div>
        </FakeBrowser>
      </AbsoluteFill>
      {/* Popup positioned to match the `to` rect (canvas coordinates). */}
      <div
        style={{
          position: "absolute",
          left: 700,
          top: 380,
          width: 640,
          height: 360,
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 30px 80px -20px rgba(0,0,0,0.55)",
          padding: 40,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 15,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: BRAND.green,
          }}
        >
          Privacy
        </div>
        <div
          style={{
            marginTop: 14,
            fontSize: 34,
            fontWeight: 700,
            color: TEXT.onLight,
          }}
        >
          本地处理，不出设备
        </div>
        <div
          style={{
            marginTop: 14,
            fontSize: 20,
            lineHeight: 1.5,
            color: TEXT.mutedLight,
          }}
        >
          特写推进 = 旁白讲隐私时，画面直接 zoom 到弹层，一句话对一个动作。
        </div>
      </div>
    </DetailZoom>
  </BrandCanvas>
);

/** Scene 5 — brand字卡 CTA close. */
const CtaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 15, stiffness: 100, mass: 0.7 } });
  return (
    <BrandCanvas variant="spotlight">
      <AbsoluteFill
        style={{ alignItems: "center", justifyContent: "center" }}
      >
        <div
          style={{
            textAlign: "center",
            transform: `scale(${0.94 + s * 0.06})`,
            opacity: s,
          }}
        >
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 26,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: BRAND.orange,
            }}
          >
            claude-video-kit
          </div>
          <div
            style={{
              marginTop: 24,
              fontFamily: FONT.sans,
              fontSize: 84,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: TEXT.onDark,
              lineHeight: 1.1,
            }}
          >
            重绘 UI，<span style={{ color: BRAND.orange }}>运镜</span>成片
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 34,
              color: TEXT.mutedDark,
              fontFamily: FONT.sans,
            }}
          >
            @runes_leo · leolabs.me
          </div>
        </div>
      </AbsoluteFill>
    </BrandCanvas>
  );
};

// ---- composition --------------------------------------------------------

export const UiKitDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0d0f14" }}>
      <Sequence durationInFrames={144}>
        <HookScene />
      </Sequence>
      <Sequence from={144} durationInFrames={192}>
        <BrowserScene />
      </Sequence>
      <Sequence from={336} durationInFrames={192}>
        <StackScene />
      </Sequence>
      <Sequence from={528} durationInFrames={120}>
        <ZoomScene />
      </Sequence>
      <Sequence from={648} durationInFrames={72}>
        <CtaScene />
      </Sequence>
    </AbsoluteFill>
  );
};
