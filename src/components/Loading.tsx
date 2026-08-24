import { useEffect, useState } from "react";
import { m } from "motion/react";
import { imageSrcSet, imageUrl } from "../lib/imageUrl";
import { preloadImage } from "../lib/preloadImage";
import { COVER_NAME, COVER_SIZES } from "./Cover";

// CM-04 로딩 화면 — c안에 없는 신규 UI. D안 확정(2026-08-11).
//
// `--bg` 전면에 커버 최상단과 **같은** 「The wedding of」를 띄우고, 그 아래 가는 세로선이
// 위에서부터 차오른다. 로딩이 걷히면 같은 글씨가 제자리로 이어져 화면이 튀지 않는다.
//
// 글씨는 처음부터 떠 있고 선만 움직인다. 앞서 낸 두 안이 반려된 이유가 여기 있다 —
// 글씨가 떠올랐다 사라지는 A안은 "기다리는 맛이 없다", 세로선만 덩그러니 두는 B안은
// "화면에 너무 안 보인다"였다. **진행되고 있다는 신호**가 핵심이고, 정지한 화면은
// 로딩으로 읽히지 않는다.
//
// 선의 방향은 가로 → 세로로 바뀌었다(2026-08-11 요청). B안이 반려된 이유가 세로라서가
// 아니라 **선 하나뿐이어서**였으므로, 글씨가 함께 있는 지금 구성에서는 같은 문제가
// 되풀이되지 않는다.

/**
 * 사진이 캐시에서 즉시 와도 이만큼은 보여 준다.
 *
 * 없으면 진행선이 차오르기도 전에 걷혀 화면이 한 번 깜빡인 것처럼 보인다. 재방문
 * (계좌·지도를 다시 열어 보는 하객)마다 치르는 비용이라 이보다 길게 잡지 않았다 —
 * 아래 감속 곡선에서 0.5초면 선이 이미 3분의 2쯤 차 있어 진행 신호로는 충분하다.
 */
export const MIN_VISIBLE_MS = 500;

/**
 * 사진이 오지 않아도 이 시점에는 걷는다.
 *
 * R2 가 죽었거나 회선이 끊긴 경우 `preloadImage` 의 resolve 를 기다리다 청첩장을
 * 통째로 못 보게 되는 것을 막는 상한이다. 사진 없는 커버가 로딩 화면보다 낫다.
 */
export const MAX_VISIBLE_MS = 4000;

/** 화면에 하나만 뜨는 오버레이라 고정 id 로 충분하다. */
const LABEL_ID = "loading-label";

/** index.html 의 부트 화면. 걷는 것은 App 이다 — 아래 removeBootScreen 머리말 참고. */
const BOOT_ID = "boot";

/**
 * index.html 의 부트 화면을 걷는다.
 *
 * **페인트가 끝난 뒤(effect 안)에서만 부른다.** main.tsx 의 render 직후에 지우면
 * React 가 아직 커밋하기 전일 수 있어 한 프레임이 깜빡인다.
 *
 * 부르는 자리가 Loading 이 아니라 App 인 것은 로딩 화면이 늘 뜨지는 않기 때문이다 —
 * 방명록 전체보기로 바로 들어오면 로딩을 건너뛰는데(App.tsx), 그때 이 함수가 Loading
 * 안에 있으면 부트 화면이 영영 남아 그 위를 덮는다.
 *
 * 뒤집어 말하면, 번들이 깨져 React 가 못 뜨는 경우 부트 화면은 그대로 남는다.
 * 흰 화면보다 낫다.
 */
export function removeBootScreen(): void {
  document.getElementById(BOOT_ID)?.remove();
}

/** 로딩 화면을 걷어도 되는지. 커버 사진 도착 또는 상한 도달 중 먼저 오는 쪽이다. */
export function useCoverReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const startedAt = Date.now();
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;

    const finish = () => {
      if (!cancelled) setReady(true);
    };

    timers.push(setTimeout(finish, MAX_VISIBLE_MS));

    void preloadImage(imageUrl(COVER_NAME, 960), imageSrcSet(COVER_NAME), COVER_SIZES).then(() => {
      timers.push(setTimeout(finish, Math.max(MIN_VISIBLE_MS - (Date.now() - startedAt), 0)));
    });

    // StrictMode 의 이중 마운트에서 타이머가 겹치지 않게 정리한다. 두 번째 마운트의
    // preload 는 캐시에 걸려 즉시 끝난다.
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  return ready;
}

export default function Loading() {
  return (
    <m.div
      // 진행 상황을 알리는 영역이라 status 다. 화면에 보이는 글씨는 aria-hidden 으로
      // 감춘다 — 읽어 주면 커버의 같은 문구와 겹쳐 두 번 들린다. 대신 아래 .sr-only
      // 텍스트를 두고 그것을 이름으로도 삼는다.
      //
      // aria-label 만으로는 부족했다. live 영역은 「내용의 변화」를 읽는 것이라 영역의
      // 이름을 알림으로 읽어 주지 않는데, 안의 것이 전부 aria-hidden 이면 읽을 내용이
      // 하나도 없어 로딩 중이라는 사실이 전혀 전달되지 않는다. 그렇다고 텍스트만 두면
      // 이번엔 이름이 사라진다 — status 는 내용으로 이름이 만들어지는 role 이 아니다.
      // labelledby 로 묶어 이름과 내용을 같은 노드 하나로 만든다.
      role="status"
      aria-labelledby={LABEL_ID}
      // index.html 의 부트 화면도 같은 role·같은 이름을 쓴다. 이 컴포넌트가 그것을 지우기
      // 전까지 잠깐 둘이 공존하므로, 테스트가 role 로 집으면 두 요소로 풀린다.
      data-testid="loading"
      // 페이드아웃 0.4초 동안에도 이 오버레이는 DOM 에 남는다. 그때 pointer-events 를
      // 끄지 않으면, 거의 투명해져 보이지도 않는 판이 화면 전체의 탭을 삼킨다 —
      // 커버의 「scroll ↓」를 보고 바로 스와이프하는 것이 정확히 이 구간이다.
      exit={{ opacity: 0, pointerEvents: "none" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{
        position: "fixed",
        inset: 0,
        // 청첩장 컬럼 안에만 덮는다. 화면 전체를 덮으면 태블릿·PC 에서 --bg 가 가득 찼다가
        // 걷히는 순간 430px 컬럼으로 접혀, 청첩장이 한 번 쪼그라든 것처럼 보인다 (SIS-18).
        // inset:0 과 max-width 가 함께 걸리면 auto margin 이 좌우로 똑같이 나뉘어 가운데 선다.
        maxWidth: "var(--page-max)",
        margin: "0 auto",
        // 토스트(95)보다 위다. 로딩 중에는 아무것도 이 위로 올라오지 않는다.
        zIndex: 100,
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        // 화면 한가운데가 아니라 커버의 「The wedding of」와 **같은 자리**다. 아래 54px 은
        // Cover 의 header padding-top 과 같은 값이라, 로딩이 걷힐 때 글씨가 움직이지 않고
        // 그 아래로 날짜·사진이 채워진다. Cover 의 값을 바꾸면 여기도 함께 바꾼다.
        paddingTop: 54,
      }}
    >
      <span id={LABEL_ID} className="sr-only">
        청첩장을 불러오는 중
      </span>
      <m.span
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        style={{ fontFamily: "var(--font-script)", fontSize: 30, color: "var(--primary)", lineHeight: 1 }}
      >
        The wedding of
      </m.span>
      {/* 진행선은 세로다. 글씨 아래로 곧게 떨어지며 위에서부터 차오른다.
          커버에서 이 자리에 오는 것은 날짜 캡션이므로, 걷힐 때 선이 사라진 자리를
          날짜가 채운다. */}
      <span
        aria-hidden="true"
        style={{ display: "block", marginTop: 20, width: 1, height: 44, background: "var(--input-border)" }}
      >
        <m.span
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          // 감속 곡선이라 앞부분이 빠르다. 사진이 일찍 오면 중간에 걷히는데, 그때까지
          // 이미 눈에 띄게 차 있어 "멈춰 있다"로 보이지 않는다.
          transition={{ duration: 1.1, ease: [0.25, 0.6, 0.3, 1] }}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            background: "var(--primary)",
            opacity: 0.75,
            originY: 0,
          }}
        />
      </span>
    </m.div>
  );
}
