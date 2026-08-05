import { useEffect, useRef, useState } from "react";
import { useReducedMotionConfig } from "motion/react";
import Reveal from "./Reveal";
import { INVITE } from "../invite";
import { imageSrcSet, imageUrl } from "../lib/imageUrl";
import { clampIndex, scrollLeftAt, slideIndexAt } from "../lib/carousel";

// GL-01 — 고객 확정(2026-08-06)으로 c안의 2열 그리드를 가로 슬라이드로 바꿨다.
// 사진을 눌러 크게 보는 기능(GL-02)은 고객이 거절해 만들지 않는다. 라이트박스를
// 되살리지 말 것 — 명세서 시트에서도 미채택이다.
//
// 스와이프는 CSS scroll-snap 이 처리한다. Motion 의 drag 로 직접 구현하지 않는 이유는
// 관성 스크롤·키보드 조작·스크린리더 동작을 브라우저가 이미 맞게 해주기 때문이다.

const PHOTOS = INVITE.gallery;

// 트랙 좌우 여백. 슬라이드는 이 여백을 뺀 폭을 꽉 채우고, 여백에서 GAP 을 뺀 만큼
// 앞뒤 사진이 걸쳐 보인다(22px). "넘길 수 있다"는 신호다.
const PEEK = 32;
const GAP = 10;

// 원본 비율이 가로 3:2·세로 2:3·세로 3컷 스트립으로 섞여 있다. 4:5 로 잘라 맞추면
// 가로 사진의 좌우가 크게 날아가므로(고객이 고른 방식, 2026-08-06), 슬라이드 자리만
// 4:5 로 고정하고 사진은 잘리지 않게 안에 맞춘다. 자리를 고정해야 넘길 때마다
// 아래 섹션이 밀려 올라가지 않는다.
const FRAME_ASPECT = "4/5";

/** 슬라이드 하나가 차지하는 가로 폭. 여백·간격이 바뀌어도 실제 DOM 에서 잰다. */
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
  // Cover 와 같은 기준으로 판단한다 — main.tsx 의 MotionConfig reducedMotion="user".
  const reduced = useReducedMotionConfig();

  // 손가락으로 넘겼을 때도 카운터와 화살표 상태가 따라오게 한다.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const sync = () => setIndex(slideIndexAt(track.scrollLeft, stepOf(track), PHOTOS.length));
    track.addEventListener("scroll", sync, { passive: true });
    return () => track.removeEventListener("scroll", sync);
  }, []);

  const go = (delta: number) => {
    const track = trackRef.current;
    if (!track) return;
    const next = clampIndex(index + delta, PHOTOS.length);
    setIndex(next);
    track.scrollTo({
      left: scrollLeftAt(next, stepOf(track), PHOTOS.length),
      behavior: reduced ? "auto" : "smooth",
    });
  };

  const isFirst = index === 0;
  const isLast = index === PHOTOS.length - 1;

  return (
    <Reveal>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div className="script-title">Our moments</div>
        {/* c안의 "사진을 탭하면 크게 볼 수 있어요"는 확대를 만들지 않으므로 바꿨다. */}
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>옆으로 넘겨 보실 수 있어요</div>
      </div>

      <div
        ref={trackRef}
        className="gallery-track"
        // 스크롤 영역은 키보드로도 움직일 수 있어야 한다(axe scrollable-region-focusable).
        // 안에 초점을 받을 요소가 없으므로 트랙 자체가 초점을 받는다.
        tabIndex={0}
        role="group"
        aria-label="웨딩 사진 갤러리"
        style={{
          display: "flex",
          gap: GAP,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          // 좌우 여백이 스크롤 영역에 포함돼 첫 장·끝 장도 가운데 선다.
          padding: `0 ${PEEK}px`,
        }}
      >
        {PHOTOS.map((name, i) => (
          <div
            key={name}
            style={{
              flex: "0 0 100%",
              scrollSnapAlign: "center",
              // 4:5 는 슬라이드가 차지하는 자리다. 사진은 이 안에 잘리지 않게 들어가므로
              // 비율에 따라 남는 자리가 생긴다. 상자를 칠하지 않고 비워 두면 페이지 배경이
              // 그대로 보여, 사진만 떠 있는 c안의 카드 느낌이 유지된다.
              aspectRatio: FRAME_ASPECT,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={imageUrl(name, 960)}
              srcSet={imageSrcSet(name)}
              // 페이지 최대 폭 430px 에서 섹션 여백 40px 과 트랙 여백 64px 을 뺀 값이
              // 실제 표시 폭이다. 빼지 않으면 브라우저가 필요보다 큰 후보를 고른다.
              sizes={`(max-width: 430px) calc(100vw - ${20 * 2 + PEEK * 2}px), ${430 - 20 * 2 - PEEK * 2}px`}
              alt={`${INVITE.groom.name} ${INVITE.bride.name} 웨딩 사진 ${i + 1}`}
              // GL-04 — 지금 보는 장과 그 앞뒤만 미리 받고 나머지는 지연 로딩한다.
              //
              // 전부 lazy 로 두지 않는 이유는, 가로 스크롤러 안에서는 브라우저가 지연
              // 로딩을 다시 판정하는 시점이 제각각이어서다. 화면 안에 들어온 사진이
              // 그대로 비어 있는 경우를 실제로 확인했다. 하객 대부분이 카카오톡 인앱
              // 브라우저로 여는 만큼, 넘긴 자리에 사진이 없는 것은 감수할 수 없다.
              //
              // 넘기면 다음 장의 이 값이 lazy 에서 eager 로 바뀌고, 그때 로딩이 시작된다.
              loading={Math.abs(i - index) <= 1 ? "eager" : "lazy"}
              decoding="async"
              // 모서리와 그림자를 상자가 아니라 사진에 건다. contain 이라 상자에 걸면
              // 사진과 어긋난 자리에 그려진다.
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
        {/* 넘길 때마다 화면을 못 보는 사용자에게도 위치를 알린다. */}
        <span aria-live="polite" style={{ fontFamily: "var(--font-script)", fontSize: 18, color: "var(--muted-2)" }}>
          {index + 1} / {PHOTOS.length}
        </span>
        <ArrowButton label="다음 사진" disabled={isLast} onClick={() => go(1)}>
          ›
        </ArrowButton>
      </div>
    </Reveal>
  );
}

// c안 라이트박스의 원형 화살표(46px, ‹ ›)를 밝은 배경용 색으로만 바꿔 가져왔다.
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
        fontSize: 18,
        lineHeight: 1,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {children}
    </button>
  );
}
