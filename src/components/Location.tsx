import { useEffect, useRef, useState, type MouseEvent } from "react";
import Reveal from "./Reveal";
import { useToast } from "./Toast";
import { INVITE } from "../invite";
import { copyText } from "../lib/clipboard";
import { assetUrl } from "../lib/imageUrl";
import { drawVenueMap, loadKakaoMaps } from "../lib/kakaoMap";
import {
  isMobileDevice,
  kakaoMapUrl,
  naverAppUrl,
  naverWebUrl,
  openWithFallback,
  tmapAppUrl,
  tmapStoreUrl,
  type Place,
} from "../lib/mapLinks";
import { scaled } from "../lib/typeScale";

const VENUE: Place = {
  name: INVITE.venue,
  lat: INVITE.coords.lat,
  lng: INVITE.coords.lng,
};

const NAVER_APP_NAME = new URL(INVITE.siteUrl).hostname;

const TMAP_DESKTOP_NOTICE = "티맵 길안내는 휴대폰에서 열 수 있어요\n네이버지도나 카카오맵을 이용해 주세요";

type MapState = "loading" | "ready" | "unavailable";

export default function Location() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapState, setMapState] = useState<MapState>("loading");
  const [nearViewport, setNearViewport] = useState(false);
  const showToast = useToast();

  const naverWeb = naverWebUrl(VENUE);
  const isMobile = isMobileDevice(navigator.userAgent, navigator.maxTouchPoints);
  const tmapStore = tmapStoreUrl(navigator.userAgent, navigator.maxTouchPoints);

  useEffect(() => {
    const target = mapRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setNearViewport(true);
        observer.disconnect();
      },
      { rootMargin: "200px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!nearViewport) return;
    let cancelled = false;
    let disposeMap: (() => void) | undefined;

    void loadKakaoMaps()
      .then((maps) => {
        if (cancelled) return;
        const container = mapRef.current;
        if (!maps || !container) {
          setMapState("unavailable");
          return;
        }
        disposeMap = drawVenueMap(maps, container, { lat: VENUE.lat, lng: VENUE.lng, label: `${INVITE.venue} 위치` });
        setMapState("ready");
      })
      .catch(() => {
        if (!cancelled) setMapState("unavailable");
      });

    return () => {
      cancelled = true;
      disposeMap?.();
    };
  }, [nearViewport]);

  const handleCopy = async () => {
    const copied = await copyText(INVITE.address);
    showToast(copied ? "주소가 복사되었습니다" : "복사에 실패했어요\n주소를 길게 눌러 주세요");
  };

  return (
    <Reveal>
      <div className="card" style={{ padding: "38px 26px" }}>
        <div style={{ marginBottom: 22 }}>
          <div className="script-title">Location</div>
          <div data-testid="venue-title" style={{ fontSize: scaled(17), fontWeight: 700, marginTop: 10, lineHeight: 1.5 }}>
            {INVITE.venue}
            <br />
            {INVITE.hall.split(" ")[0]}
          </div>
          <div style={{ fontSize: scaled(14), color: "var(--text-body)", marginTop: 6 }}>{INVITE.address}</div>
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
            background: "repeating-linear-gradient(45deg, #e6e7da, #e6e7da 12px, #dde0cf 12px, #dde0cf 24px)",
          }}
        >
          <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />

          <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 10 }} />

          {mapState === "unavailable" && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span
                style={{
                  fontSize: scaled(13),
                  color: "var(--text-body)",
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

        <div className="map-links">
          <MapLink
            label="네이버지도"
            logo="logo-naver-map.webp"
            href={naverWeb}
            appUrl={isMobile ? naverAppUrl(VENUE, NAVER_APP_NAME) : undefined}
            fallbackUrl={isMobile ? naverWeb : undefined}
          />
          <MapLink label="카카오맵" logo="logo-kakao-map.webp" href={kakaoMapUrl(VENUE)} />
          {isMobile ? (
            <MapLink label="티맵" logo="logo-tmap.webp" href={tmapStore} appUrl={tmapAppUrl(VENUE)} fallbackUrl={tmapStore} />
          ) : (
            <MapNotice label="티맵" logo="logo-tmap.webp" notice={TMAP_DESKTOP_NOTICE} />
          )}
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
            fontSize: scaled(14),
            cursor: "pointer",
          }}
        >
          주소 복사하기
        </button>

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
    </Reveal>
  );
}

function MapLink({
  label,
  logo,
  href,
  appUrl,
  fallbackUrl,
}: {
  label: string;
  logo: string;
  href: string;
  appUrl?: string;
  fallbackUrl?: string;
}) {
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cancelRef.current?.(), []);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!appUrl || !fallbackUrl) return;
    event.preventDefault();
    cancelRef.current?.();
    cancelRef.current = openWithFallback(appUrl, fallbackUrl);
  };

  return (
    <a href={href} onClick={handleClick} target="_blank" rel="noopener">
      <MapLinkFace label={label} logo={logo} />
    </a>
  );
}

function MapNotice({ label, logo, notice }: { label: string; logo: string; notice: string }) {
  const showToast = useToast();

  return (
    <button type="button" onClick={() => showToast(notice)}>
      <MapLinkFace label={label} logo={logo} />
    </button>
  );
}

function MapLinkFace({ label, logo }: { label: string; logo: string }) {
  return (
    <>
      <img src={assetUrl(logo)} alt="" aria-hidden="true" width={18} height={18} loading="lazy" decoding="async" />
      {label}
    </>
  );
}

function Guide({ term, detail }: { term: string; detail: string }) {
  return (
    <div>
      <dt style={{ fontSize: scaled(13.5), color: "var(--primary)", fontWeight: 700, marginBottom: 5 }}>{term}</dt>
      <dd style={{ margin: 0, fontSize: scaled(14.5), color: "var(--text-body)", lineHeight: 1.7, whiteSpace: "pre-line" }}>
        {detail}
      </dd>
    </div>
  );
}
