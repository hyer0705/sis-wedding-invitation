import Reveal from "./Reveal";
import { useToast } from "./Toast";
import { copyLink, loadKakaoSdk, shareKakao, type ShareResult } from "../lib/share";
import { scaled } from "../lib/typeScale";

const LEAD = "이 청첩장을 전해주세요";

export default function Share() {
  const showToast = useToast();

  const handle = async (run: () => Promise<ShareResult>) => {
    let result: ShareResult;
    try {
      result = await run();
    } catch {
      result = "failed";
    }
    if (result === "copied") showToast("청첩장 주소가 복사되었습니다");
    else if (result === "failed") showToast("공유에 실패했어요\n주소창의 주소를 복사해 주세요");
  };

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
