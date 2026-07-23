import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BrandCanvas } from "./BrandCanvas";
import { FakeTerminal } from "./FakeTerminal";
import { BRAND, FONT, SURFACE, TEXT } from "./theme";

export type OkxAspScene = {
  id: string;
  type: "cover" | "tagline" | "terminal" | "sku" | "end";
  terminal?: "audit" | "verdict" | "preflight" | "football";
  durationInFrames: number;
  from: number;
  audio?: string;
  caption_en: string;
  caption_zh: string;
};

export type OkxAspDemoProps = {
  fps?: number;
  scenes?: OkxAspScene[];
  bgm?: string;
  bgmVolume?: number;
  totalFrames?: number;
};

const TERMINAL_PRESETS = {
  audit: [
    { text: "curl -X POST .../agent-delivery-acceptance-audit", prompt: true },
    { text: '"verdict": "needs_review",', delay: 42, color: BRAND.orange },
    { text: '"score": 65,', delay: 58, color: BRAND.orange },
    {
      text: '"missing": ["rollback plan", "validation result"]',
      delay: 74,
      color: TEXT.mutedDark,
    },
  ],
  verdict: [
    { text: 'curl -X POST .../token-dd-verdict -d \'{"asset":"ETH"}\'', prompt: true },
    { text: '"verdict_bucket": "avoid",', delay: 44, color: BRAND.orange },
    { text: '"score_0_100": 25,', delay: 60, color: BRAND.orange },
    { text: '"hard_stops": ["no_dex_liquidity"]', delay: 76, color: TEXT.mutedDark },
  ],
  preflight: [
    { text: "curl -X POST .../pm-trade-preflight", prompt: true },
    { text: '"action": "watch",', delay: 40, color: BRAND.green },
    { text: '"confidence": 0.6,', delay: 56, color: BRAND.orange },
    {
      text: '"risk_flags": ["extreme_implied_probability"]',
      delay: 72,
      color: BRAND.orange,
    },
  ],
  football: [
    { text: "curl -X POST .../pm-event-readout  # France vs Morocco", prompt: true },
    { text: '"linked_event_count": 8, "related_market_count": 350,', delay: 36, color: BRAND.green },
    { text: '"matrix_status": "complete", "category": "football",', delay: 52, color: BRAND.green },
    {
      text: '"central_thesis": "Draw has material mass — not a free ML lunch"',
      delay: 68,
      color: BRAND.orange,
    },
    {
      text: '"recommended_expression": "draw_90m"  // not a buy tip',
      delay: 88,
      color: TEXT.mutedDark,
    },
  ],
} as const;

const DEFAULT_SCENES: OkxAspScene[] = [
  {
    id: "cover",
    type: "cover",
    durationInFrames: 192,
    from: 0,
    caption_en: "I'm one person. This is Leo Labs — my agent company on OKX.AI.",
    caption_zh: "一个人，一家公司，在 OKX.AI 上做 Agent 闸门。",
  },
  {
    id: "tagline",
    type: "tagline",
    durationInFrames: 210,
    from: 192,
    caption_en: "Agents need delivery proof — and a real match matrix before they trade.",
    caption_zh: "Agent 需要交付证据，以及交易前的同场全矩阵分析。",
  },
  {
    id: "audit",
    type: "terminal",
    terminal: "audit",
    durationInFrames: 336,
    from: 402,
    caption_en: "First: did the worker actually deliver evidence?",
    caption_zh: "第一关：交付验收——工人真的交证据了吗？",
  },
  {
    id: "football",
    type: "terminal",
    terminal: "football",
    durationInFrames: 420,
    from: 738,
    caption_en: "Second: Football Event Analyst — full same-event matrix, not a price reprint.",
    caption_zh: "第二关：足球事件分析——同场全矩阵，不是复读价格。",
  },
  {
    id: "sku",
    type: "sku",
    durationInFrames: 240,
    from: 1158,
    caption_en: "Tip of the spear: Audit + Football. Tennis and research gates sit beside it.",
    caption_zh: "尖刀：验收闸门 + 足球事件分析；网球与投研闸门作配套。",
  },
  {
    id: "end",
    type: "end",
    durationInFrames: 192,
    from: 1398,
    caption_en: "One person, one company — agents do the work.",
    caption_zh: "一个人，一家公司——Agent 干活，人在搭 OPC 玩法。",
  },
];

const BilingualCaption: React.FC<{ en: string; zh: string }> = ({ en, zh }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [8, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        bottom: 56,
        left: 0,
        right: 0,
        textAlign: "center",
        padding: "0 72px",
        opacity,
      }}
    >
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 30,
          fontWeight: 700,
          lineHeight: 1.35,
          color: TEXT.onDark,
          textShadow: "0 2px 20px rgba(0,0,0,0.7)",
        }}
      >
        {en}
      </div>
      <div
        style={{
          marginTop: 10,
          fontFamily: FONT.sans,
          fontSize: 24,
          fontWeight: 500,
          lineHeight: 1.4,
          color: BRAND.green,
          textShadow: "0 2px 16px rgba(0,0,0,0.65)",
        }}
      >
        {zh}
      </div>
    </div>
  );
};

const HeroTitle: React.FC<{
  eyebrow: string;
  title: string;
  subtitle?: string;
  highlight?: string;
}> = ({ eyebrow, title, subtitle, highlight }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 15, stiffness: 100, mass: 0.7 } });
  const parts = highlight ? title.split(highlight) : [title];
  return (
    <div style={{ textAlign: "center", transform: `scale(${0.94 + s * 0.06})`, opacity: s }}>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 24,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: BRAND.orange,
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          marginTop: 28,
          fontFamily: FONT.sans,
          fontSize: 78,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: TEXT.onDark,
          lineHeight: 1.08,
        }}
      >
        {highlight ? (
          <>
            {parts[0]}
            <span style={{ color: BRAND.orange }}>{highlight}</span>
            {parts[1] ?? ""}
          </>
        ) : (
          title
        )}
      </div>
      {subtitle ? (
        <div style={{ marginTop: 22, fontSize: 36, color: TEXT.mutedDark }}>{subtitle}</div>
      ) : null}
    </div>
  );
};

const SkuRow: React.FC<{ sku: string; index: number }> = ({ sku, index }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [index * 8, index * 8 + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        opacity,
        width: "100%",
        maxWidth: 920,
        padding: "18px 28px",
        borderRadius: 16,
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${BRAND.green}33`,
        fontFamily: FONT.sans,
        fontSize: 30,
        fontWeight: 600,
        color: TEXT.onDark,
      }}
    >
      {sku}
    </div>
  );
};

const SceneBody: React.FC<{ scene: OkxAspScene }> = ({ scene }) => {
  switch (scene.type) {
    case "cover":
      return (
        <BrandCanvas variant="spotlight" overlay="grid">
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
            <HeroTitle
              eyebrow="One person, one company"
              title="Leo Labs"
              subtitle="Agent gates on OKX.AI · #3977"
              highlight="Labs"
            />
          </AbsoluteFill>
          <BilingualCaption en={scene.caption_en} zh={scene.caption_zh} />
        </BrandCanvas>
      );
    case "tagline":
      return (
        <BrandCanvas variant="warm" overlay="grid">
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 120 }}>
            <HeroTitle
              eyebrow="Audit · Football Event Analyst"
              title="Agents need gates"
              subtitle="delivery proof + same-event match matrix"
              highlight="gates"
            />
          </AbsoluteFill>
          <BilingualCaption en={scene.caption_en} zh={scene.caption_zh} />
        </BrandCanvas>
      );
    case "terminal": {
      const key = scene.terminal ?? "audit";
      const lines = TERMINAL_PRESETS[key];
      return (
        <BrandCanvas variant="dark" overlay="grid">
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
            <FakeTerminal
              width={1180}
              height={520}
              title="api.leolabs.me"
              lines={[...lines]}
              accentColor={BRAND.orange}
            />
          </AbsoluteFill>
          <BilingualCaption en={scene.caption_en} zh={scene.caption_zh} />
        </BrandCanvas>
      );
    }
    case "sku":
      return (
        <BrandCanvas variant="cool" overlay="noise">
          <AbsoluteFill
            style={{
              alignItems: "center",
              justifyContent: "center",
              gap: 28,
              padding: "0 160px",
            }}
          >
            {[
              "Agent Delivery Audit Gate",
              "Football Event Analyst  ← tip of spear",
              "Tennis Event Analyst",
              "Token DD Verdict",
              "PM Trade Preflight",
              "Content Verify Claims",
            ].map((sku, i) => (
              <SkuRow key={sku} sku={sku} index={i} />
            ))}
          </AbsoluteFill>
          <BilingualCaption en={scene.caption_en} zh={scene.caption_zh} />
        </BrandCanvas>
      );
    case "end":
      return (
        <BrandCanvas variant="spotlight">
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
            <HeroTitle
              eyebrow="#Okxai"
              title="Building the OPC playbook"
              subtitle="@runes_leo · api.leolabs.me · #3977"
              highlight="OPC"
            />
          </AbsoluteFill>
          <BilingualCaption en={scene.caption_en} zh={scene.caption_zh} />
        </BrandCanvas>
      );
    default:
      return null;
  }
};

/** OKX ASP Hackathon demo — ui-kit brand + EN VO + bilingual captions + BGM */
export const OkxAspDemo: React.FC<OkxAspDemoProps> = (props) => {
  const rawScenes = props.scenes?.length ? props.scenes : DEFAULT_SCENES;
  let offset = 0;
  const scenes = rawScenes.map((scene) => {
    const normalized = { ...scene, from: offset };
    offset += scene.durationInFrames;
    return normalized;
  });
  const bgm = props.bgm;
  const bgmVolume = props.bgmVolume ?? 0.14;

  return (
    <AbsoluteFill style={{ backgroundColor: SURFACE.base }}>
      {bgm ? <Audio src={staticFile(bgm)} volume={bgmVolume} /> : null}
      {scenes.map((scene) => (
        <Sequence
          key={scene.id}
          from={scene.from}
          durationInFrames={scene.durationInFrames}
        >
          {scene.audio ? <Audio src={staticFile(scene.audio)} volume={1} /> : null}
          <SceneBody scene={scene} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const defaultOkxAspDemoProps: OkxAspDemoProps = {
  fps: 24,
  scenes: DEFAULT_SCENES,
  totalFrames: DEFAULT_SCENES.reduce((a, s) => a + s.durationInFrames, 0),
};
