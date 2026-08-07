import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FakeBrowser } from "../ui-kit/FakeBrowser";
import { AnimatedBackground, VideoTheme } from "../ui-kit/AnimatedBackground";
import { FitMedia, MediaKind } from "../ui-kit/FitMedia";

export type ImageMode = "background" | "popup" | "screen" | "banner" | "poster";

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
  /** Nền động dùng chung cho cả video (random mỗi video). "default" = giữ nguyên nền cũ. */
  theme?: VideoTheme;
  /** "image" (mặc định) hoặc "video" — khi "video", src trỏ tới file video, poster/src dùng làm fallback nếu video lỗi. */
  mediaType?: MediaKind;
  /** Video minh hoạ thật (Pexels...) — chỉ dùng khi mediaType === "video". */
  videoSrc?: string;
  mediaDurationSeconds?: number;
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
  theme = "default",
  mediaType = "image",
  videoSrc,
  mediaDurationSeconds,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const isVideo = mediaType === "video" && Boolean(videoSrc);
  const mediaSrc = isVideo ? videoSrc! : src;
  const videoProps =
    isVideo && mediaDurationSeconds
      ? mediaDurationSeconds * fps < durationInFrames
        ? { loopDurationInFrames: Math.max(1, Math.round(mediaDurationSeconds * fps)) }
        : { trimAfter: durationInFrames }
      : undefined;
  // Ảnh chụp màn hình web luôn ngang (16:9-16:10, giống browserWidth/Height ở
  // mode "screen" bên dưới) — nhét "contain" vào khung dọc sẽ bị thu nhỏ nặng,
  // chữ trên ảnh không đọc được. Tính khung đúng tỉ lệ 16:10 rồi "cover" neo
  // top trong ĐÚNG khung đó để gần như không crop gì mà vẫn full-size dễ đọc.
  // Video B-roll thật thì đã gần khớp tỉ lệ dọc sẵn nên giữ "contain" full vùng.
  const screenshotBoxHeightPct = Math.min(78, ((width * 0.625) / height) * 100);

  const entrance = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 120, mass: 0.7 },
  });
  const textOpacity = interpolate(frame, [8, 24], [0, 1], {
    extrapolateRight: "clamp",
  });
  const imgSrc = staticFile(src);
  // Zoom + pan liên tục trong suốt slide (KenBurns rõ hơn bản cũ) — cho cảm
  // giác "sống", không phải ảnh tĩnh cứng đờ. Áp cho khung screenshot/browser mockup.
  const kenBurns = interpolate(frame, [0, durationInFrames], [1, 1.08], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const kenBurnsPanX = interpolate(frame, [0, durationInFrames], [0, -14], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Tilt 3D nhẹ, trôi chậm suốt slide — cho khung browser cảm giác "nổi khối".
  const tiltY = interpolate(frame, [0, durationInFrames], [-3, 3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bgLayer = theme !== "default" ? <AnimatedBackground theme={theme} accentColor={accentColor} /> : null;

  if (mode === "background") {
    return (
      <AbsoluteFill style={{ background: "#0b0b0f" }}>
        {bgLayer}
        <AbsoluteFill style={{ opacity: 0.55 + entrance * 0.1 }}>
          <FitMedia src={mediaSrc} kind={isVideo ? "video" : "image"} videoProps={videoProps} posterSrc={src} />
        </AbsoluteFill>
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

  if (mode === "banner") {
    // banner: ảnh full-bleed phía trên, dải "ribbon" màu accent nghiêng ở dưới
    // chứa title, kèm 1 chip ảnh nhỏ nổi đè lên mép ảnh/ribbon — layout khác
    // hẳn "screen" (không giả browser) và "poster" (không chữ khổng lồ giữa khung).
    const bannerSkew = interpolate(frame, [0, 15], [-8, -2], { extrapolateRight: "clamp" });
    const titleSlide = spring({ frame, fps, config: { damping: 16, stiffness: 130, mass: 0.6 } });
    const titleX = interpolate(titleSlide, [0, 1], [-140, 0]);
    const chipRotate = interpolate(frame, [0, 20], [-16, -6], { extrapolateRight: "clamp" });
    const chipScale = 0.6 + entrance * 0.4;
    return (
      <AbsoluteFill style={{ background: "#0b0b0f" }}>
        {bgLayer}
        <FitMedia
          src={mediaSrc}
          kind={isVideo ? "video" : "image"}
          videoProps={videoProps}
          posterSrc={src}
          contentArea={{ top: 0, left: 0, width: "100%", height: isVideo ? "78%" : `${screenshotBoxHeightPct}%` }}
          fit={isVideo ? "contain" : "cover"}
          transform={`scale(${kenBurns}) translateX(${kenBurnsPanX}px)`}
        />
        <AbsoluteFill
          style={{
            background: isVideo
              ? "linear-gradient(180deg, transparent 55%, #0b0b0f 92%)"
              : `linear-gradient(180deg, transparent ${Math.max(0, screenshotBoxHeightPct - 5)}%, #0b0b0f 85%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: height * 0.58,
            left: 56,
            width: 104,
            height: 104,
            borderRadius: 22,
            overflow: "hidden",
            border: `3px solid ${accentColor}`,
            boxShadow: `0 12px 32px ${accentColor}66`,
            transform: `rotate(${chipRotate}deg) scale(${chipScale})`,
          }}
        >
          <Img src={imgSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: height * 0.13, paddingLeft: 56, paddingRight: 56 }}>
          {title && (
            <div
              style={{
                display: "inline-block",
                background: `linear-gradient(90deg, ${accentColor}, ${accentColor}cc)`,
                padding: "16px 30px",
                borderRadius: 12,
                transform: `skewX(${bannerSkew}deg) translateX(${titleX}px)`,
                boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
                maxWidth: width * 0.82,
              }}
            >
              <div
                style={{
                  transform: `skewX(${-bannerSkew}deg)`,
                  fontSize: 46 * fontScale,
                  fontWeight: 900,
                  color: "#0b0b0f",
                  fontFamily: "'Inter', -apple-system, sans-serif",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1,
                }}
              >
                {title}
              </div>
            </div>
          )}
          {subtitle && (
            <div style={{ marginTop: 16, opacity: textOpacity, color: "#e5e7eb", fontSize: 26 * fontScale, maxWidth: width * 0.8 }}>
              {subtitle}
            </div>
          )}
        </div>
      </AbsoluteFill>
    );
  }

  if (mode === "poster") {
    // poster: ảnh full-bleed duotone kịch tính + title khổng lồ nghiêng/xoay
    // nhẹ kiểu poster phim, ribbon "HOT" góc trên trái — khác hẳn 2 mode kia.
    const titleSpring = spring({ frame, fps, config: { damping: 13, stiffness: 110, mass: 0.7 } });
    const titleY = interpolate(titleSpring, [0, 1], [90, 0]);
    const rotateDeg = interpolate(frame, [0, durationInFrames], [-4, -1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        {bgLayer}
        <FitMedia
          src={mediaSrc}
          kind={isVideo ? "video" : "image"}
          videoProps={videoProps}
          posterSrc={src}
          contentArea={isVideo ? undefined : { top: 0, left: 0, width: "100%", height: `${screenshotBoxHeightPct}%` }}
          fit={isVideo ? "contain" : "cover"}
          transform={`scale(${kenBurns}) translateX(${kenBurnsPanX}px)`}
          filter="saturate(1.15) contrast(1.05)"
        />
        <AbsoluteFill
          style={{
            background: `linear-gradient(180deg, ${accentColor}33 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.92) 100%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 76,
            left: -64,
            background: accentColor,
            color: "#0b0b0f",
            fontWeight: 800,
            fontSize: 22 * fontScale,
            padding: "8px 70px",
            transform: "rotate(-35deg)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          }}
        >
          HOT
        </div>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: height * 0.16 }}>
          {title && (
            <div
              style={{
                opacity: interpolate(titleSpring, [0, 1], [0, 1]),
                transform: `translateY(${titleY}px) skewY(-4deg) rotate(${rotateDeg}deg)`,
                fontSize: 82 * fontScale,
                fontWeight: 900,
                textTransform: "uppercase",
                color: "#fff",
                textAlign: "center",
                maxWidth: width * 0.9,
                lineHeight: 0.98,
                letterSpacing: "-0.03em",
                fontFamily: "'Inter', -apple-system, sans-serif",
                textShadow: `0 0 60px ${accentColor}88, 0 10px 40px rgba(0,0,0,0.8)`,
              }}
            >
              {title}
            </div>
          )}
          {subtitle && (
            <div style={{ marginTop: 24, opacity: textOpacity, color: "#e5e7eb", fontSize: 30 * fontScale, maxWidth: width * 0.85, textAlign: "center" }}>
              {subtitle}
            </div>
          )}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  if (mode === "popup") {
    const scale = (0.9 + entrance * 0.1) * kenBurns;
    return (
      <AbsoluteFill
        style={{
          background: theme === "default" ? "linear-gradient(180deg, #0b0b0f 0%, #1a1a25 100%)" : "transparent",
          alignItems: "center",
          justifyContent: "center",
          padding: 90,
        }}
      >
        {bgLayer}
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
            transform: `perspective(1400px) rotateY(${tiltY}deg) scale(${scale})`,
            borderRadius: 20,
            overflow: "hidden",
            boxShadow: `0 30px 90px -15px ${accentColor}66, 0 40px 100px rgba(0,0,0,0.6)`,
            outline: `1px solid ${accentColor}44`,
            maxWidth: width * 0.86,
          }}
        >
          {mediaType === "video" && videoSrc ? (
            <OffthreadVideo
              src={staticFile(videoSrc)}
              muted
              trimAfter={videoProps && "trimAfter" in videoProps ? videoProps.trimAfter : undefined}
              style={{ width: "100%", display: "block" }}
            />
          ) : (
            <Img src={imgSrc} style={{ width: "100%", display: "block" }} />
          )}
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
  const scale = (0.92 + entrance * 0.08) * kenBurns;

  return (
    <AbsoluteFill
      style={{
        background: theme === "default" ? "linear-gradient(180deg, #0b0b0f 0%, #1a1a25 100%)" : "transparent",
        alignItems: "center",
        justifyContent: "center",
        padding: 60,
      }}
    >
      {bgLayer}
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
      {/* Glass panel — nền kính mờ phía sau browser mockup, cho cảm giác "đắt tiền"
          thay vì browser trôi nổi trực tiếp trên nền. */}
      <div
        style={{
          position: "relative",
          padding: 28,
          borderRadius: 28,
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
          transform: `translateX(${kenBurnsPanX}px)`,
        }}
      >
        <div
          style={{
            transform: `perspective(1400px) rotateY(${tiltY}deg) scale(${scale})`,
            borderRadius: 18,
            boxShadow: `0 30px 90px -20px ${accentColor}55, 0 0 0 1px rgba(255,255,255,0.06)`,
          }}
        >
          <FakeBrowser
            url={browserUrl}
            width={browserWidth}
            height={browserHeight}
            accentColor={accentColor}
          >
            <FitMedia src={mediaSrc} kind={isVideo ? "video" : "image"} videoProps={videoProps} posterSrc={src} />
          </FakeBrowser>
        </div>
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
