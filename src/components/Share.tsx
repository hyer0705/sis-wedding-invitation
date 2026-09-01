import Reveal from "./Reveal";
import { useToast } from "./Toast";
import { copyLink, loadKakaoSdk, shareKakao, type ShareResult } from "../lib/share";
import { scaled } from "../lib/textSize";

// SH-01 카카오톡 공유 · SH-02 링크 복사. c안에 공유 UI 가 없어 새로 만들었다.
//
// 고객이 A안(두 버튼을 같은 무게로)을 택했다(2026-08-11). 카카오톡 쪽만 색을 채운
// 안도 함께 냈으나, 화면의 마지막이 조용히 끝나는 편을 골랐다. 그래서 계좌 복사
// 버튼(--surface)보다 한 단계 옅은 --surface-2 를 쓴다 — 푸터 바로 위라 여기서
// 시선을 붙들면 인사말이 묻힌다.
//
// 자리는 푸터 위다. 청첩장을 다 읽은 다음에 "전해 주세요"가 나오는 순서다.

const LEAD = "이 청첩장을 전해주세요";

export default function Share() {
  const showToast = useToast();

  // 카톡 창이나 공유 시트가 뜨면 화면이 눈에 띄게 바뀌므로 토스트를 얹지 않는다.
  // 복사는 화면이 그대로라 알려 주지 않으면 눌렸는지조차 알 수 없다.
  //
  // 거부까지 여기서 받는다. 공유 사슬은 제 안에서 폴백을 다 처리하지만, 그 바깥으로
  // 예외가 새면 버튼이 아무 반응 없이 죽는다 — 하객에게는 고장과 구분되지 않는다.
  const handle = async (run: () => Promise<ShareResult>) => {
    let result: ShareResult;
    try {
      result = await run();
    } catch {
      result = "failed";
    }
    if (result === "copied") showToast("청첩장 주소가 복사되었습니다");
    else if (result === "failed") showToast("공유에 실패했어요\n주소창을 길게 눌러 복사해 주세요");
  };

  // 이 섹션이 보이면 공유 SDK 를 미리 받아 둔다. 버튼을 누른 뒤에 받기 시작하면
  // 카톡 창이 뜨기까지 하객이 빈손으로 기다리고, PC 에서는 팝업이 막힐 수 있다
  // (src/lib/share.ts 의 loadKakaoSdk 주석). 여기는 페이지 맨 아래라 첫 페인트를
  // 방해하지 않는다 — SDK 를 index.html 에서 걷어낸 이유가 그것이다(SIS-18).
  return (
    <Reveal onInView={() => void loadKakaoSdk()}>
      <section aria-label="청첩장 공유" style={{ padding: "30px 20px 0" }}>
        <p style={{ margin: "0 0 14px", textAlign: "center", fontSize: scaled(13), color: "var(--text-body)" }}>{LEAD}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <ShareButton onClick={() => handle(shareKakao)}>카카오톡으로 공유</ShareButton>
          <ShareButton onClick={() => handle(copyLink)}>링크 복사</ShareButton>
        </div>
      </section>
    </Reveal>
  );
}

function ShareButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: "15px 8px",
        background: "var(--surface-2)",
        border: "none",
        borderRadius: "var(--radius-control)",
        // 이 배경 위에 얹는 글자용 토큰이다. 2026-08-13 부터 CI 의 axe 가 color-contrast 를
        // 실제로 검사하므로(SIS-18), 여기를 바꿔 대비가 무너지면 E2E 가 잡는다.
        color: "var(--on-surface)",
        fontFamily: "var(--font-serif)",
        fontSize: scaled(13),
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
