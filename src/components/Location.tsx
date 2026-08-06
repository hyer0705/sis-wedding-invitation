import { useEffect, useRef, useState, type MouseEvent } from "react";
import Reveal from "./Reveal";
import Toast, { useToast } from "./Toast";
import { INVITE } from "../invite";
import { copyText } from "../lib/clipboard";
import { drawVenueMap, loadKakaoMaps } from "../lib/kakaoMap";
import { kakaoMapUrl, naverAppUrl, naverWebUrl, openWithFallback, tmapAppUrl, tmapStoreUrl, type Place } from "../lib/mapLinks";

// MP-01~05 — 오시는 길. c안 §6 을 옮기면서 세 가지가 달라졌다.
//   · 주소가 바뀌었다(경인로 577 → 새말로 97). 좌표·링크가 전부 여기에 매여 있다.
//   · 버스 안내가 늘었다(MP-04). c안에는 지하철·자가용·주차만 있었다.
//   · "카카오내비" 버튼이 "카카오맵"이 됐다 — 이유는 lib/mapLinks.ts 머리말 참고.
// 셔틀버스(MP-06)는 미채택이라 만들지 않는다.

const VENUE: Place = {
  name: INVITE.venue,
  lat: INVITE.coords.lat,
  lng: INVITE.coords.lng,
};

// 네이버가 요구하는 호출자 식별자. 앱이 "어디서 부른 것인지"를 표시하는 데 쓴다.
const NAVER_APP_NAME = new URL(INVITE.siteUrl).hostname;

type MapState = "loading" | "ready" | "unavailable";

export default function Location() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapState, setMapState] = useState<MapState>("loading");
  const [nearViewport, setNearViewport] = useState(false);
  const { message, show } = useToast();

  // 앱이 없을 때 갈 곳. 티맵만 기기별로 갈라진다.
  const naverWeb = naverWebUrl(VENUE);
  const tmapStore = tmapStoreUrl(navigator.userAgent);

  // 지도 SDK 는 커버·갤러리 사진과 대역폭을 다투지 않도록 이 섹션이 가까워졌을 때 받는다.
  // 하객 상당수가 데이터 통신으로 여는 만큼, 첫 화면에 필요 없는 것을 미리 받지 않는다.
  useEffect(() => {
    const target = mapRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setNearViewport(true);
        observer.disconnect();
      },
      // 화면에 닿기 전에 받기 시작해야 도착했을 때 지도가 이미 그려져 있다.
      { rootMargin: "200px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!nearViewport) return;
    let cancelled = false;

    void loadKakaoMaps()
      .then((maps) => {
        if (cancelled) return;
        const container = mapRef.current;
        // 키가 없는 환경(로컬·CI·키를 넣지 않은 프리뷰)에서는 여기로 온다. 지도 자리만
        // 안내로 바뀌고 아래 지도 앱 버튼은 그대로 동작한다.
        if (!maps || !container) {
          setMapState("unavailable");
          return;
        }
        drawVenueMap(maps, container, { lat: VENUE.lat, lng: VENUE.lng, label: `${INVITE.venue} 위치` });
        setMapState("ready");
      })
      // SDK 는 받았는데 지도 생성이 실패하는 경우(도메인 미등록, SDK 내부 예외)가 있다.
      // 여기서 받지 않으면 상태가 "loading" 에 굳어, 하객은 줄무늬 자리만 보고 지도가
      // 로딩 중인지 고장 난 것인지 알 수 없다. 키가 없을 때와 같은 안내로 떨어뜨린다.
      .catch(() => {
        if (!cancelled) setMapState("unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, [nearViewport]);

  const handleCopy = async () => {
    const copied = await copyText(INVITE.address);
    // 실패 문구는 토스트가 떠 있는 1.8초 안에 읽을 수 있어야 한다. 줄 나눔을 직접 잡는
    // 것은 320px 에서 브라우저가 끊는 자리가 어색해서다.
    show(copied ? "주소가 복사되었습니다" : "복사에 실패했어요\n주소를 길게 눌러 주세요");
  };

  return (
    <Reveal>
      <div className="card" style={{ padding: "38px 26px" }}>
        <div style={{ marginBottom: 22 }}>
          <div className="script-title">Location</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 10 }}>
            {/* 홀 이름만 쓴다. INVITE.hall 은 "다이너스티홀 7F" 인데 층수는 바로 아래
                주소에도 들어 있어, 통째로 쓰면 "7F" 가 두 줄 연속으로 보인다. */}
            {INVITE.venue} {INVITE.hall.split(" ")[0]}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-sub)", marginTop: 6 }}>{INVITE.address}</div>
        </div>

        <div
          data-testid="venue-map"
          className="venue-map"
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16/10",
            borderRadius: 18,
            overflow: "hidden",
            // 지도가 뜨면 가려진다. 뜨기 전까지 자리를 지켜 아래 내용이 밀려 올라가지 않게 한다.
            background: "repeating-linear-gradient(45deg, #e6e7da, #e6e7da 12px, #dde0cf 12px, #dde0cf 24px)",
          }}
        >
          <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />

          {/*
            지도를 덮는 투명한 판. 하객이 지도 위에 손가락을 올려도 청첩장이 스크롤되게 한다.

            카카오가 만드는 지도 안쪽 div 들은 타일을 컨테이너보다 넓게 깔아 두어 브라우저가
            "스크롤되는 박스"로 인식한다. 그래서 세로 스와이프가 그 안에서 삼켜지고 페이지까지
            오지 않는다 — draggable:false 로도, touch-action 으로도 막지 못하는 경로다.
            제스처를 지도 바깥의 평범한 요소가 받게 하면 브라우저가 평소대로 페이지를 굴린다.

            지도는 위치를 보여 주기만 하고 확대·이동은 아래 지도 앱 버튼이 맡으므로, 이 판이
            가로막는 상호작용이 없다.
          */}
          {/* 카카오가 자기 요소에 쌓임 순서를 매기므로, 그 위로 올라가야 제스처를 받는다. */}
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 10 }} />

          {mapState === "unavailable" && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span
                style={{
                  fontSize: 12.5,
                  color: "var(--text-sub)",
                  background: "var(--surface-3)",
                  padding: "8px 14px",
                  borderRadius: 14,
                }}
              >
                아래 지도 앱에서 위치를 확인하실 수 있어요
              </span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <MapLink label="네이버지도" href={naverWeb} appUrl={naverAppUrl(VENUE, NAVER_APP_NAME)} fallbackUrl={naverWeb} />
          {/* 카카오맵 주소 하나가 앱과 웹을 모두 처리한다. 스킴을 따로 시도하지 않는다. */}
          <MapLink label="카카오맵" href={kakaoMapUrl(VENUE)} />
          <MapLink label="티맵" href={tmapStore} appUrl={tmapAppUrl(VENUE)} fallbackUrl={tmapStore} />
        </div>

        <button
          type="button"
          onClick={handleCopy}
          style={{
            width: "100%",
            marginTop: 8,
            padding: "13px 0",
            background: "var(--primary)",
            border: "none",
            borderRadius: "var(--radius-control)",
            color: "var(--on-primary)",
            fontFamily: "var(--font-serif)",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          주소 복사하기
        </button>

        {/* 안내 항목은 "이름 ↔ 내용" 짝이라 목록이 아니라 설명 목록으로 둔다. */}
        <dl style={{ margin: "26px 0 0", display: "flex", flexDirection: "column", gap: 16, textAlign: "left" }}>
          <Guide term="지하철" detail={INVITE.transport.subway} />
          <Guide
            term="버스"
            detail={`간선·직행·일반 ${INVITE.transport.bus.trunk.join(", ")}\n지선 ${INVITE.transport.bus.branch.join(", ")}`}
          />
          <Guide term="자가용" detail={INVITE.transport.car} />
          <Guide
            term="주차"
            detail={`${INVITE.transport.parking.capacity} · ${INVITE.transport.parking.freeHours}\n${INVITE.transport.parking.howTo} (${INVITE.transport.parking.overCharge})`}
          />
        </dl>
      </div>

      <Toast message={message} />
    </Reveal>
  );
}

/**
 * 지도 앱 버튼.
 *
 * `appUrl` 이 있으면 앱 스킴을 먼저 시도하고 열리지 않을 때 `href` 로 돌아간다. 없으면
 * 평범한 링크로 둔다(카카오맵). 스킴을 href 에 바로 넣지 않는 이유는, 앱이 없을 때
 * 아무 일도 일어나지 않거나 iOS 에서 "주소가 올바르지 않다"는 경고만 뜨기 때문이다.
 */
function MapLink({ label, href, appUrl, fallbackUrl }: { label: string; href: string; appUrl?: string; fallbackUrl?: string }) {
  const cancelRef = useRef<(() => void) | null>(null);

  // 앱으로 넘어간 뒤 돌아왔을 때 예약된 폴백이 남아 있으면 엉뚱한 화면이 열린다.
  useEffect(() => () => cancelRef.current?.(), []);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!appUrl || !fallbackUrl) return; // 평범한 링크로 둔다
    event.preventDefault();
    // 연달아 누르면 앞서 예약된 폴백이 남아 스토어가 한 번 더 열린다.
    cancelRef.current?.();
    cancelRef.current = openWithFallback(appUrl, fallbackUrl);
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      target="_blank"
      rel="noopener"
      style={{
        flex: 1,
        textAlign: "center",
        padding: "13px 0",
        background: "var(--surface)",
        borderRadius: "var(--radius-control)",
        textDecoration: "none",
        color: "var(--on-surface)",
        fontSize: 13,
      }}
    >
      {label}
    </a>
  );
}

function Guide({ term, detail }: { term: string; detail: string }) {
  return (
    <div>
      <dt style={{ fontSize: 12.5, color: "var(--primary)", fontWeight: 700, marginBottom: 5 }}>{term}</dt>
      {/* INVITE 의 줄바꿈을 그대로 살린다 — 고객이 확인한 줄 나눔이다. */}
      <dd style={{ margin: 0, fontSize: 14, color: "var(--text-body)", lineHeight: 1.6, whiteSpace: "pre-line" }}>{detail}</dd>
    </div>
  );
}
