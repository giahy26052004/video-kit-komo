import React, { useState } from "react";
import { AbsoluteFill, Img, Loop, OffthreadVideo, staticFile } from "remotion";

export type MediaKind = "image" | "video";

export interface ContentArea {
  top: string | number;
  left: string | number;
  width: string | number;
  height: string | number;
}

const FULL_AREA: ContentArea = { top: 0, left: 0, width: "100%", height: "100%" };

export interface FitMediaVideoProps {
  trimBefore?: number;
  trimAfter?: number;
  /** Nếu clip ngắn hơn slide, bọc trong <Loop> với số frame gốc của clip để lặp mượt. */
  loopDurationInFrames?: number;
  muted?: boolean;
  volume?: number;
}

export interface FitMediaProps {
  /** Path tương đối --public-dir, sẽ tự staticFile(). */
  src: string;
  kind?: MediaKind;
  /** Vùng chứa nội dung chính — mặc định toàn khung cha. */
  contentArea?: ContentArea;
  /**
   * "contain" (mặc định) — không bao giờ crop, dùng cho video B-roll/ảnh
   * minh hoạ chung (đã gần khớp tỉ lệ khung, contain gần như không mất gì).
   * "cover" — dùng cho ảnh chụp màn hình UI ngang (16:9/16:10) cần đọc được
   * chữ: neo top (objectPosition "top") để giữ phần header quan trọng nhất,
   * PHẢI đi kèm contentArea đã tính đúng tỉ lệ ~16:10 (xem ImageSlide banner/
   * poster) để crop ở mức tối thiểu, không phải cover trần lên cả khung dọc.
   */
  fit?: "contain" | "cover";
  /** Lớp backdrop blur-cover phủ kín khung, tránh lộ nền trống khi tỉ lệ khác nhau. */
  backdrop?: boolean;
  /** Transform (kenBurns scale/pan...) áp cho cả backdrop lẫn foreground để nhất quán. */
  transform?: string;
  foregroundStyle?: React.CSSProperties;
  /** Filter riêng cho foreground (vd saturate/contrast cho poster). */
  filter?: string;
  videoProps?: FitMediaVideoProps;
  /** Ảnh fallback nếu video lỗi runtime (onError). */
  posterSrc?: string;
}

/**
 * Hiển thị ảnh/video luôn thấy trọn vẹn nội dung (object-fit: contain trong
 * contentArea) trong khi vẫn phủ kín khung bằng 1 lớp backdrop blur-cover phía
 * sau — tránh vừa bị crop (cover) vừa bị hở nền (contain trần không backdrop).
 */
export const FitMedia: React.FC<FitMediaProps> = ({
  src,
  kind = "image",
  contentArea = FULL_AREA,
  fit = "contain",
  backdrop = true,
  transform,
  foregroundStyle,
  filter,
  videoProps,
  posterSrc,
}) => {
  const [videoFailed, setVideoFailed] = useState(false);
  const resolvedSrc = staticFile(src);
  const effectiveKind: MediaKind = videoFailed && posterSrc ? "image" : kind;
  const effectiveSrc = videoFailed && posterSrc ? staticFile(posterSrc) : resolvedSrc;
  const objectPosition = fit === "cover" ? "top" : undefined;

  const foreground =
    effectiveKind === "video" ? (
      <OffthreadVideo
        src={effectiveSrc}
        muted={videoProps?.muted ?? true}
        volume={videoProps?.volume}
        trimBefore={videoProps?.trimBefore}
        trimAfter={videoProps?.trimAfter}
        onError={() => setVideoFailed(true)}
        style={{ width: "100%", height: "100%", objectFit: fit, objectPosition, transform, filter, ...foregroundStyle }}
      />
    ) : (
      <Img
        src={effectiveSrc}
        style={{ width: "100%", height: "100%", objectFit: fit, objectPosition, transform, filter, ...foregroundStyle }}
      />
    );

  const foregroundWrapped =
    effectiveKind === "video" && videoProps?.loopDurationInFrames ? (
      <Loop durationInFrames={videoProps.loopDurationInFrames} style={{ width: "100%", height: "100%" }}>
        {foreground}
      </Loop>
    ) : (
      foreground
    );

  return (
    <>
      {backdrop &&
        (effectiveKind === "video" ? (
          <OffthreadVideo
            src={effectiveSrc}
            muted
            trimBefore={videoProps?.trimBefore}
            trimAfter={videoProps?.trimAfter}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "blur(40px) brightness(0.5) saturate(1.2)",
              transform: "scale(1.15)",
            }}
          />
        ) : (
          <Img
            src={effectiveSrc}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "blur(40px) brightness(0.5) saturate(1.2)",
              transform: "scale(1.15)",
            }}
          />
        ))}
      <AbsoluteFill
        style={{
          top: contentArea.top,
          left: contentArea.left,
          width: contentArea.width,
          height: contentArea.height,
        }}
      >
        {foregroundWrapped}
      </AbsoluteFill>
    </>
  );
};
