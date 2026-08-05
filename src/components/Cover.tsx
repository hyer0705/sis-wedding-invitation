import { useEffect } from "react";
import { m, useMotionValue, useReducedMotionConfig } from "motion/react";
import { INVITE } from "../invite";
import { imageSrcSet, imageUrl } from "../lib/imageUrl";

// 커버 사진. 사진 교체 시 `npm run optimize` 산출물 이름만 여기서 바꾼다.
// 실제 호스트는 VITE_IMAGE_BASE_URL(Cloudflare R2)이 정한다 — lib/imageUrl.ts 참고.
const COVER_NAME = "1_main";

// c안의 data-parallax와 같은 값 — 스크롤 0.14배로 따라 내려오되 90px에서 멈춘다.
const PARALLAX_RATIO = 0.14;
const PARALLAX_MAX = 90;
// 이미지를 아래로 밀어도 아치 안쪽에 빈 곳이 생기지 않도록 미리 키워 둔다.
const PARALLAX_SCALE = 1.08;

export default function Cover() {
  // MotionConfig reducedMotion="user"는 transition이 붙은 애니메이션만 줄인다.
  // 스크롤 값에 직접 물린 패럴랙스는 여기서 직접 꺼야 한다.
  // useReducedMotion이 아니라 이 훅을 쓰는 이유는 OS 설정과 MotionConfig 설정을
  // 함께 보기 때문이다 — main.tsx의 reducedMotion="user"와 같은 기준으로 판단한다.
  const reduced = useReducedMotionConfig();
  const parallaxY = useMotionValue(0);

  // Motion의 useScroll을 쓰지 않는다. StrictMode의 이중 마운트에서 내부 구독이
  // 되살아나지 않아 개발 화면에서만 패럴랙스가 멈춘다(motion 12.42). 구독을 직접
  // 들고 있으면 정리·재등록이 우리 손에 있어 그 문제를 겪지 않는다.
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
    <m.header
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.4 }}
      style={{ padding: "54px 26px 60px", textAlign: "center", position: "relative", overflow: "hidden" }}
    >
      <div style={{ fontFamily: "var(--font-script)", fontSize: 30, color: "var(--primary)", lineHeight: 1 }}>The wedding of</div>
      <div
        style={{ marginTop: 10, fontFamily: "var(--font-caption)", fontSize: 11, letterSpacing: "0.4em", color: "var(--muted)" }}
      >
        {INVITE.dateDots}
      </div>
      <div
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
          // 카드 최대 폭 430px에서 헤더 좌우 여백 26px씩을 뺀 값이 실제 표시 폭이다.
          // 여백을 빼지 않으면 브라우저가 필요보다 큰 후보(960w)를 고른다.
          sizes="(max-width: 430px) calc(100vw - 52px), 378px"
          alt={`신랑 ${INVITE.groom.name}, 신부 ${INVITE.bride.name}의 웨딩 사진`}
          // LCP 요소다. 다른 리소스보다 먼저 받게 한다.
          fetchPriority="high"
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
      <h1 style={{ margin: "30px 0 0", fontWeight: 700, fontSize: 30, letterSpacing: "0.06em" }}>
        {INVITE.groom.name} <span style={{ color: "var(--primary)", fontWeight: 400 }}>&amp;</span> {INVITE.bride.name}
      </h1>
      <div style={{ marginTop: 14, fontSize: 14, color: "var(--text-sub)", lineHeight: 1.7 }}>
        {/* 날짜는 위 캡션(dateDots)이 이미 보여준다. c안대로 요일·시각만 둔다. */}
        {INVITE.dayText}
        <br />
        {INVITE.venue} {INVITE.hall}
      </div>
      <m.div
        animate={{ y: [0, 7, 0], opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        style={{ marginTop: 36, display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 7 }}
      >
        <span style={{ fontFamily: "var(--font-script)", fontSize: 17, color: "#a9b3a1" }}>scroll</span>
        <span style={{ fontSize: 15, color: "#bcc4b2" }}>↓</span>
      </m.div>
    </m.header>
  );
}
