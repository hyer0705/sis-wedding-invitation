import { useEffect, useRef, useState } from "react";
import { m, useMotionValue, useReducedMotionConfig } from "motion/react";
import { INVITE } from "../invite";
import { imageSrcSet, imageUrl } from "../lib/imageUrl";

// 커버 사진. 사진 교체 시 `npm run optimize` 산출물 이름만 여기서 바꾼다.
// 실제 호스트는 VITE_IMAGE_BASE_URL(Cloudflare R2)이 정한다 — lib/imageUrl.ts 참고.
//
// 로딩 화면(CM-04)이 이 사진을 기다렸다 걷히므로 App 도 아래 두 값을 읽는다.
// 여기 한 곳에서만 정해야 프리로드와 화면이 같은 파일을 받는다 — 어긋나면 브라우저가
// 서로 다른 너비를 골라 사진을 두 장 내려받는다.
export const COVER_NAME = "1_main";

// 카드 최대 폭 430px에서 헤더 좌우 여백 26px씩을 뺀 값이 실제 표시 폭이다.
// 여백을 빼지 않으면 브라우저가 필요보다 큰 후보(960w)를 고른다.
export const COVER_SIZES = "(max-width: 430px) calc(100vw - 52px), 378px";

// c안의 data-parallax와 같은 값 — 스크롤 0.14배로 따라 내려오되 90px에서 멈춘다.
const PARALLAX_RATIO = 0.14;
const PARALLAX_MAX = 90;
// 이미지를 아래로 밀어도 아치 안쪽에 빈 곳이 생기지 않도록 미리 키워 둔다.
const PARALLAX_SCALE = 1.08;

export default function Cover({ coverReady = false }: { coverReady?: boolean }) {
  // MotionConfig reducedMotion="user"는 transition이 붙은 애니메이션만 줄인다.
  // 스크롤 값에 직접 물린 패럴랙스는 여기서 직접 꺼야 한다.
  // useReducedMotion이 아니라 이 훅을 쓰는 이유는 OS 설정과 MotionConfig 설정을
  // 함께 보기 때문이다 — main.tsx의 reducedMotion="user"와 같은 기준으로 판단한다.
  const reduced = useReducedMotionConfig();
  const parallaxY = useMotionValue(0);

  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // SIS-29 — 사진을 페이드로 얹을지 그냥 켤지.
  //
  // 로딩 화면이 걷히는 시점에 사진이 아직 없었다면, 하객은 지금 shimmer 가 도는 빈 아치를
  // 보고 있다는 뜻이다(MAX_VISIBLE_MS 4초 상한에 걸린 경우). 그 자리에 사진이 뒤늦게
  // 들어올 때만 페이드가 필요하다.
  //
  // 반대로 사진이 먼저 와서 로딩이 걷힌 정상 경로에는 걸지 않는다. SIS-17 이 커버의
  // opacity 0→1(1.4초)을 걷어낸 이유가 그것이다 — 로딩 화면에 가려진 채 흘러가 회선마다
  // 걷히는 모습이 달라졌다.
  //
  // 판정은 state 가 아니라 **요소의 complete** 로 한다. 로딩 화면을 걷는 타이머와 이 img 의
  // load 이벤트는 서로 다른 태스크라, 사진이 이미 도착했는데도 setLoaded 가 아직 커밋되지
  // 않은 순간이 생긴다. 그 틈에 state 로 판정하면 정상 경로에까지 페이드가 걸려 위의 이중
  // 연출이 되살아난다. complete 는 이벤트와 무관하게 그 시점의 사실을 알려준다.
  const [fadesIn, setFadesIn] = useState(false);
  useEffect(() => {
    if (coverReady && !imgRef.current?.complete) setFadesIn(true);
  }, [coverReady]);

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
    // CV-02 인트로 — 예전에는 여기서 opacity 0→1 을 1.4초에 걸쳐 페이드인했다.
    // 로딩 화면(CM-04)이 생기면서 그 연출은 **로딩이 걷히는 순간으로 옮겨졌다.**
    //
    // 둘을 함께 두면 페이드인이 로딩 화면에 가려진 채 흘러가 버린다. 실측하면 로딩이
    // 걷히는 순간 커버가 opacity 0.85~0.89 였다 — 로딩의 또렷한 「The wedding of」가
    // 같은 자리의 흐린 글씨로 넘어가 한 번 옅어졌다 진해졌다. 게다가 사진이 상한(4초)
    // 까지 늦으면 페이드가 이미 끝나 있어, 걷히는 모습이 회선마다 달라졌다.
    //
    // 지금은 커버가 처음부터 불투명하게 준비돼 있고 로딩 오버레이만 걷힌다. 글씨는
    // 자리에 그대로 있고 그 아래로 날짜·사진이 드러난다.
    <m.header style={{ padding: "54px 26px 60px", textAlign: "center", position: "relative", overflow: "hidden" }}>
      <div style={{ fontFamily: "var(--font-script)", fontSize: 30, color: "var(--primary)", lineHeight: 1 }}>The wedding of</div>
      <div
        style={{ marginTop: 10, fontFamily: "var(--font-caption)", fontSize: 11, letterSpacing: "0.4em", color: "var(--muted)" }}
      >
        {INVITE.dateDots}
      </div>
      <div
        // 사진이 오기 전 아치 안을 채워 둔다. 로딩 화면은 상한(4초)에 걷히는데 3G 에서는
        // 사진이 그보다 늦게 오는 일이 흔하고, 그때 아치가 빈 채로 드러난다. 사진은
        // objectFit: cover 로 이 상자를 꽉 채우므로 도착하면 완전히 덮인다.
        //
        // .skeleton 이 면(--surface)과 좌→우 광택을 함께 맡는다(SIS-29). 광택은 이 상자의
        // overflow: hidden + 아치 radius 안에서만 지나가므로 모서리를 넘지 않는다.
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
          // LCP 요소다. 다른 리소스보다 먼저 받게 한다.
          fetchPriority="high"
          onLoad={() => setLoaded(true)}
          // 못 받은 경우에도 기다리기를 그만둔다. 그러지 않으면 사진이 투명한 채(image-pending)
          // 남아 대체 텍스트조차 보이지 않고, 빈 아치 위로 광택만 끝없이 돈다. R2 가 죽었을 때
          // 로딩 화면이 상한에서 걷히는 것과 같은 이유다.
          onError={() => setLoaded(true)}
          // 캐시에 있으면 React 가 onLoad 를 붙이기 전에 로드가 끝나 있을 수 있다.
          // 그때는 이 콜백이 붙는 시점에 complete 가 이미 true 다.
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
      <h1 style={{ margin: "30px 0 0", fontWeight: 700, fontSize: 30, letterSpacing: "0.06em" }}>
        {INVITE.groom.name} <span style={{ color: "var(--primary)", fontWeight: 400 }}>&amp;</span> {INVITE.bride.name}
      </h1>
      <div style={{ marginTop: 14, fontSize: 14, color: "var(--text-sub)", lineHeight: 1.7 }}>
        {/* 날짜는 위 캡션(dateDots)이 이미 보여준다. c안대로 요일·시각만 둔다. */}
        {INVITE.dayText}
        <br />
        {INVITE.venue} {INVITE.hall}
      </div>
      {/* SIS-18 — 색 두 개를 토큰 밖에서 직접 적어 두었던 자리다(#a9b3a1·#bcc4b2). 불투명일 때도
          배경 위 대비가 1.96·1.62 로, 페이지에서 가장 낮았다.

          **펄스 하한을 0.55 에서 0.8 로 올린 것도 함께다.** 이 글씨는 합성된 색으로 읽히므로
          하한이 그대로면 어떤 색을 넣어도 소용이 없다 — 토큰표에서 가장 어두운 --text 로도
          0.55 에서 3.06 이다. 0.8 이면 --text-body 로 4.95 가 나오고 펄스도 눈에 남는다.
          이 값을 낮추는 변경은 색을 아무리 진하게 해도 AA 를 되돌린다. */}
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
