import { useEffect, useRef, useState } from "react";
import { useReducedMotionConfig } from "motion/react";
import Reveal from "./Reveal";
import { INVITE } from "../invite";
import { imageSrcSet, imageUrl } from "../lib/imageUrl";
import { clampIndex, scrollLeftAt, slideIndexAt } from "../lib/carousel";
import { scaled } from "../lib/typeScale";

const PHOTOS = INVITE.gallery;

const PEEK = 32;
const GAP = 10;

const FRAME_ASPECT = "4/5";

const ANNOUNCE_DELAY = 400;

function stepOf(track: HTMLElement): number {
  const [first, second] = track.children;
  if (first instanceof HTMLElement && second instanceof HTMLElement) {
    return second.offsetLeft - first.offsetLeft;
  }
  return track.clientWidth;
}

export default function Gallery() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [spoken, setSpoken] = useState(0);
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(() => new Set());
  const markLoaded = (name: string) => setLoaded((prev) => (prev.has(name) ? prev : new Set(prev).add(name)));
  const reduced = useReducedMotionConfig();
  const [reached, setReached] = useState(false);

  const goalRef = useRef<number | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const sync = () => {
      const at = slideIndexAt(track.scrollLeft, stepOf(track), PHOTOS.length);
      if (goalRef.current !== null) {
        if (at !== goalRef.current) return;
        goalRef.current = null;
      }
      setIndex(at);
    };

    const release = () => {
      goalRef.current = null;
    };

    track.addEventListener("scroll", sync, { passive: true });
    track.addEventListener("pointerdown", release, { passive: true });
    track.addEventListener("wheel", release, { passive: true });
    return () => {
      track.removeEventListener("scroll", sync);
      track.removeEventListener("pointerdown", release);
      track.removeEventListener("wheel", release);
    };
  }, []);

  const go = (delta: number) => {
    const track = trackRef.current;
    if (!track) return;
    const next = clampIndex(index + delta, PHOTOS.length);
    goalRef.current = next;
    setIndex(next);
    track.scrollTo({
      left: scrollLeftAt(next, stepOf(track), PHOTOS.length),
      behavior: reduced ? "auto" : "smooth",
    });
  };

  useEffect(() => {
    const id = window.setTimeout(() => setSpoken(index), ANNOUNCE_DELAY);
    return () => window.clearTimeout(id);
  }, [index]);

  const isFirst = index === 0;
  const isLast = index === PHOTOS.length - 1;

  return (
    <Reveal onInView={() => setReached(true)}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div className="script-title">Our moments</div>
        <div style={{ fontSize: scaled(13), color: "var(--text-body)", marginTop: 4 }}>옆으로 넘겨 보실 수 있어요</div>
      </div>

      <div
        ref={trackRef}
        className="gallery-track"
        tabIndex={0}
        role="group"
        aria-label="웨딩 사진 갤러리"
        style={{
          display: "flex",
          gap: GAP,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          padding: `0 ${PEEK}px`,
        }}
      >
        {PHOTOS.map((name, i) => (
          <div
            key={name}
            className={loaded.has(name) ? undefined : "skeleton"}
            data-testid="gallery-slot"
            style={{
              flex: "0 0 100%",
              scrollSnapAlign: "center",
              aspectRatio: FRAME_ASPECT,
              ...(loaded.has(name) ? null : { borderRadius: 18 }),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={imageUrl(name, 960)}
              srcSet={imageSrcSet(name)}
              onLoad={() => markLoaded(name)}
              onError={() => markLoaded(name)}
              ref={(el) => {
                if (el?.complete) markLoaded(name);
              }}
              sizes={`(max-width: 430px) calc(100vw - ${20 * 2 + PEEK * 2}px), ${430 - 20 * 2 - PEEK * 2}px`}
              alt={`${INVITE.groom.name} ${INVITE.bride.name} 웨딩 사진 ${i + 1}`}
              loading={Math.abs(i - index) <= 1 ? "eager" : "lazy"}
              fetchPriority={reached ? "auto" : "low"}
              decoding="async"
              className={["image-fade", loaded.has(name) ? null : "image-pending"].filter(Boolean).join(" ")}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                display: "block",
                borderRadius: 18,
                boxShadow: "0 10px 26px rgba(80, 95, 75, 0.1)",
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 24 }}>
        <ArrowButton label="이전 사진" disabled={isFirst} onClick={() => go(-1)}>
          ‹
        </ArrowButton>
        <span
          data-testid="gallery-counter"
          aria-hidden="true"
          style={{ fontFamily: "var(--font-script)", fontSize: 18, color: "var(--muted-2)" }}
        >
          {index + 1} / {PHOTOS.length}
        </span>
        <ArrowButton label="다음 사진" disabled={isLast} onClick={() => go(1)}>
          ›
        </ArrowButton>
      </div>

      <span className="sr-only" data-testid="gallery-live" aria-live="polite">
        {PHOTOS.length}장 중 {spoken + 1}번째
      </span>
    </Reveal>
  );
}

function ArrowButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        background: "var(--card)",
        border: "1px solid var(--input-border)",
        color: "var(--primary)",
        width: 46,
        height: 46,
        borderRadius: "50%",
        fontSize: scaled(18),
        lineHeight: 1,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {children}
    </button>
  );
}
