import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FakeBrowser } from "../ui-kit/FakeBrowser";

export type ImageMode = "background" | "popup" | "screen";

interface ImageSlideProps {
  /** Đường dẫn ảnh, tương đối so với --public-dir (thường là workspace/ của project). */
  src: string;
  mode?: ImageMode;
  /** Chữ đè lên ảnh (dùng cho background) hoặc caption dưới card/browser (popup/screen). */
  title?: string;
  subtitle?: string;
  /** Địa chỉ hiện trong thanh address bar giả — chỉ dùng khi mode="screen". */
  browserUrl?: string;
  fontScale?: number;
  accentColor?: string;
}

/**
 * ImageSlide — chèn ảnh thật (screenshot, ảnh sản phẩm...) vào video theo 3 kiểu:
 *  - background: ảnh phủ full khung hình, có lớp tối để chữ dễ đọc
 *  - popup: ảnh nhỏ nổi giữa khung, bo góc + đổ bóng như 1 card
 *  - screen: ảnh nhét vào khung browser giả (FakeBrowser) — trông như đang xem trên máy tính
 */
export const ImageSlide: React.FC<ImageSlideProps> = ({
  src,
  mode = "screen",
  title,
  subtitle,
  browserUrl = "komoapi.site",
  fontScale = 1,
  accentColor = "#22d3ee",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 120, mass: 0.7 },
  });
  const textOpacity = interpolate(frame, [8, 24], [0, 1], {
    extrapolateRight: "clamp",
  });
  const imgSrc = staticFile(src);

  if (mode === "background") {
    return (
      <AbsoluteFill style={{ background: "#0b0b0f" }}>
        <Img
          src={imgSrc}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.55 + entrance * 0.1,
          }}
        />
        {/* Lớp tối để chữ dễ đọc trên ảnh */}
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(180deg, rgba(11,11,15,0.35) 0%, rgba(11,11,15,0.85) 100%)",
          }}
        />
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "flex-end",
            paddingBottom: 140,
            textAlign: "center",
          }}
        >
          {title && (
            <div
              style={{
                opacity: textOpacity,
                fontSize: 64 * fontScale,
                fontWeight: 800,
                color: "#fff",
                fontFamily: "'Inter', -apple-system, sans-serif",
                textShadow: `0 0 60px ${accentColor}66`,
                maxWidth: width * 0.85,
                letterSpacing: "-0.02em",
              }}
            >
              {title}
            </div>
          )}
          {subtitle && (
            <div
              style={{
                opacity: textOpacity,
                marginTop: 20,
                fontSize: 32 * fontScale,
                color: "#cbd5e1",
                fontWeight: 500,
                maxWidth: width * 0.8,
              }}
            >
              {subtitle}
            </div>
          )}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  if (mode === "popup") {
    const scale = 0.9 + entrance * 0.1;
    return (
      <AbsoluteFill
        style={{
          background: "linear-gradient(180deg, #0b0b0f 0%, #1a1a25 100%)",
          alignItems: "center",
          justifyContent: "center",
          padding: 90,
        }}
      >
        {title && (
          <div
            style={{
              opacity: textOpacity,
              position: "absolute",
              top: 130,
              fontSize: 52 * fontScale,
              fontWeight: 800,
              color: "#fff",
              textAlign: "center",
              maxWidth: width * 0.85,
              fontFamily: "'Inter', -apple-system, sans-serif",
            }}
          >
            {title}
          </div>
        )}
        <div
          style={{
            transform: `scale(${scale})`,
            borderRadius: 20,
            overflow: "hidden",
            boxShadow: "0 40px 100px rgba(0,0,0,0.6)",
            outline: `1px solid ${accentColor}44`,
            maxWidth: width * 0.86,
          }}
        >
          <Img src={imgSrc} style={{ width: "100%", display: "block" }} />
        </div>
        {subtitle && (
          <div
            style={{
              opacity: textOpacity,
              marginTop: 32,
              fontSize: 30 * fontScale,
              color: "#9ca3af",
              textAlign: "center",
              maxWidth: width * 0.8,
            }}
          >
            {subtitle}
          </div>
        )}
      </AbsoluteFill>
    );
  }

  // mode === "screen" — nhét ảnh vào khung browser giả.
  // Canvas dọc (vd 1080x1920) nên browser landscape phải scale nhỏ lại cho vừa chiều ngang.
  const browserWidth = Math.round(width * 0.92);
  const browserHeight = Math.round(browserWidth * 0.625); // tỉ lệ ~16:10 giống ảnh gốc
  const scale = 0.92 + entrance * 0.08;

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0b0b0f 0%, #1a1a25 100%)",
        alignItems: "center",
        justifyContent: "center",
        padding: 60,
      }}
    >
      {title && (
        <div
          style={{
            opacity: textOpacity,
            position: "absolute",
            top: 110,
            fontSize: 50 * fontScale,
            fontWeight: 800,
            color: "#fff",
            textAlign: "center",
            maxWidth: width * 0.85,
            fontFamily: "'Inter', -apple-system, sans-serif",
          }}
        >
          {title}
        </div>
      )}
      <div style={{ transform: `scale(${scale})` }}>
        <FakeBrowser
          url={browserUrl}
          width={browserWidth}
          height={browserHeight}
          accentColor={accentColor}
        >
          <Img
            src={imgSrc}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "top",
            }}
          />
        </FakeBrowser>
      </div>
      {subtitle && (
        <div
          style={{
            opacity: textOpacity,
            marginTop: 36,
            fontSize: 30 * fontScale,
            color: "#9ca3af",
            textAlign: "center",
            maxWidth: width * 0.8,
          }}
        >
          {subtitle}
        </div>
      )}
    </AbsoluteFill>
  );
};
