import { useEffect, useRef, useState } from "react";
import { m, useMotionValue, useReducedMotionConfig } from "motion/react";
import { INVITE } from "../invite";
import { imageSrcSet, imageUrl } from "../lib/imageUrl";
import { scaled } from "../lib/typeScale";

export const COVER_NAME = "1_main";

export const COVER_SIZES = "(max-width: 430px) calc(100vw - 52px), 378px";

const PARALLAX_RATIO = 0.14;
const PARALLAX_MAX = 90;
const PARALLAX_SCALE = 1.08;

export default function Cover({ coverReady = false }: { coverReady?: boolean }) {
  const reduced = useReducedMotionConfig();
  const parallaxY = useMotionValue(0);

  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [fadesIn, setFadesIn] = useState(false);
  useEffect(() => {
    if (coverReady && !imgRef.current?.complete) setFadesIn(true);
  }, [coverReady]);

  useEffect(() => {
    if (reduced) {
      parallaxY.set(0);
      return;
    }
    const update = () => parallaxY.set(Math.min(window.scrollY * PARALLAX_RATIO, PARALLAX_MAX));
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [reduced, parallaxY]);

  return (
    <m.header style={{ padding: "54px 26px 60px", textAlign: "center", position: "relative", overflow: "hidden" }}>
      <div style={{ fontFamily: "var(--font-script)", fontSize: 30, color: "var(--primary)", lineHeight: 1 }}>The wedding of</div>
      <div
        style={{
          marginTop: 10,
          fontFamily: "var(--font-caption)",
          fontSize: scaled(11.5),
          letterSpacing: "0.4em",
          color: "var(--text-sub)",
        }}
      >
        {INVITE.dateDots}
      </div>
      <div
        className={loaded ? "skeleton is-loaded" : "skeleton"}
        data-testid="cover-frame"
        style={{
          marginTop: 32,
          borderRadius: "200px 200px 18px 18px",
          overflow: "hidden",
          boxShadow: "0 24px 50px rgba(80, 95, 75, 0.2)",
        }}
      >
        <m.img
          src={imageUrl(COVER_NAME, 960)}
          srcSet={imageSrcSet(COVER_NAME)}
          sizes={COVER_SIZES}
          alt={`신랑 ${INVITE.groom.name}, 신부 ${INVITE.bride.name}의 웨딩 사진`}
          fetchPriority="high"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          ref={(el) => {
            imgRef.current = el;
            if (el?.complete) setLoaded(true);
          }}
          className={[loaded ? null : "image-pending", fadesIn ? "image-fade" : null].filter(Boolean).join(" ")}
          style={{
            width: "100%",
            aspectRatio: "4/5",
            objectFit: "cover",
            display: "block",
            y: parallaxY,
            scale: reduced ? 1 : PARALLAX_SCALE,
          }}
        />
      </div>
      <h1 style={{ margin: "30px 0 0", fontWeight: 900, fontSize: 20, letterSpacing: "0.20em" }}>
        {INVITE.groom.name} <span style={{ color: "var(--primary)", fontWeight: 400 }}>&amp;</span> {INVITE.bride.name}
      </h1>
      <div style={{ marginTop: 14, fontSize: scaled(14.5), color: "var(--text-body)", lineHeight: 1.7 }}>
        {INVITE.dayText}
        <br />
        {INVITE.venue} {INVITE.hall}
      </div>
      <m.div
        animate={{ y: [0, 7, 0], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        style={{ marginTop: 36, display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 7 }}
      >
        <span style={{ fontFamily: "var(--font-script)", fontSize: 17, color: "var(--text-body)" }}>scroll</span>
        <span style={{ fontSize: 15, color: "var(--text-body)" }}>↓</span>
      </m.div>
    </m.header>
  );
}
