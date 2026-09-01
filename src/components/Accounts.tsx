import { useId, useState } from "react";
import Reveal from "./Reveal";
import { useToast } from "./Toast";
import { INVITE } from "../invite";
import { copyText } from "../lib/clipboard";
import type { Account } from "../lib/private-data";
import { scaled } from "../lib/textSize";

// AC-01 계좌 안내 · AC-02 계좌번호 복사. c안 §7 을 옮기면서 배치가 달라졌다.
//
// c안은 측마다 계좌 한 건만 상정했지만 실제는 측당 2건이라(신랑·아버지 / 신부·어머니),
// 같은 카드 안에 계좌가 넷 쌓인다. 그 상태로 c안의 세 줄 구성(은행 / 번호 / 예금주)을
// 쓰면 열두 줄이 되어 어느 계좌가 누구 것인지 한눈에 들어오지 않았다. 고객 확인을 거쳐
// 한 건을 두 줄로 줄였다(2026-08-11) — 첫 줄에 "역할 + 예금주", 둘째 줄에 "은행 + 번호".
//
// 카카오페이 송금(AC-03)과 노출 제어(AC-04)는 미채택이라 만들지 않는다.

// c안의 카피 그대로다. 고객이 문구를 따로 주면 그때 INVITE 로 옮긴다 — 지금 옮기면
// 고객이 확정하지 않은 값이 INVITE 에 섞여, 확정값만 둔다는 규칙이 흐려진다.
const LEAD = "참석이 어려우신 분들을 위해\n마음 전하실 곳을 안내드립니다.";

export default function Accounts() {
  // 양측 다 비었으면 섹션째 내린다. 계좌에는 mock 폴백이 없어(src/invite.ts) 환경변수를
  // 넣지 않은 개발·CI 화면이 이 경우인데, 안내 문구만 있고 계좌는 없는 카드가 남으면
  // 하객에게는 고장으로 보인다.
  if (INVITE.accounts.groom.length === 0 && INVITE.accounts.bride.length === 0) return null;

  return (
    <Reveal>
      <div className="card" style={{ padding: "38px 26px", textAlign: "center" }}>
        <div className="script-title">Thanks heart</div>
        {/* 초대글 카드와 같은 34px 구분선. 타이틀과 안내 문구를 떼어 놓는다. */}
        <div style={{ width: 34, height: 1, background: "var(--input-border)", margin: "18px auto 24px" }} />
        <p
          style={{ margin: "0 0 26px", fontSize: scaled(14), color: "var(--text-body)", lineHeight: 1.9, whiteSpace: "pre-line" }}
        >
          {LEAD}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "left" }}>
          <AccountGroup side="groom" label="신랑측" accounts={INVITE.accounts.groom} />
          <AccountGroup side="bride" label="신부측" accounts={INVITE.accounts.bride} />
        </div>
      </div>
    </Reveal>
  );
}

/**
 * 한쪽 집안의 계좌를 담는 아코디언.
 *
 * 두 아코디언은 서로의 상태를 모른다 — 각자 자기 열림 여부만 들고 있어서, 한쪽을 열어도
 * 다른 쪽이 닫히지 않는다. 양가를 나란히 보려는 하객이 있어 한 번에 하나만 열리게 하지
 * 않았다.
 */
function AccountGroup({ side, label, accounts }: { side: "groom" | "bride"; label: string; accounts: readonly Account[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  // 한쪽만 비는 경우 — 그 측 환경변수가 비었거나 형식이 깨져 parseAccounts 가 전부
  // 버린 때다. 열어 봐야 아무것도 없는 아코디언은 두지 않는다.
  if (accounts.length === 0) return null;

  return (
    <div style={{ border: "1px solid var(--surface-2)", borderRadius: 16, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        // 닫혀 있는 동안에는 붙이지 않는다. 패널을 DOM 에서 빼기 때문에, 그대로 두면
        // 없는 id 를 가리켜 스크린리더의 "제어 대상으로 이동"이 아무 일도 하지 않는다.
        aria-controls={open ? panelId : undefined}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          padding: "16px 20px",
          background: "var(--surface-3)",
          border: "none",
          borderRadius: 0,
          color: "var(--text)",
          fontFamily: "var(--font-serif)",
          fontSize: scaled(14.5),
          cursor: "pointer",
        }}
      >
        {label}
        {/* 화살표는 라벨을 가운데 둔 채 오른쪽 끝에 세운다. 글의 흐름에서 빼지 않으면
            라벨이 화살표 폭만큼 왼쪽으로 밀려 두 아코디언의 라벨이 어긋난다. */}
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            right: 20,
            color: "var(--primary)",
            fontSize: scaled(13),
            lineHeight: 1,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.25s",
          }}
        >
          ⌄
        </span>
      </button>

      {/* 닫혔을 때 DOM 에서 빼는 편이 낫다. 계좌번호가 숨겨진 채 남아 있으면 스크린리더가
          아코디언을 열지 않고도 읽어 내려가고, 화면에서 접힌 것과 어긋난다. */}
      {open && (
        <div id={panelId} style={{ padding: "4px 20px" }}>
          {accounts.map((account, index) => (
            <AccountRow key={`${account.bank}-${account.number}`} side={side} account={account} first={index === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

function AccountRow({ side, account, first }: { side: "groom" | "bride"; account: Account; first: boolean }) {
  const showToast = useToast();
  const role = shortRole(account.role, side);

  const handleCopy = async () => {
    // 하이픈을 넣은 채로 복사한다(2026-08-11 확정). 화면에 보이는 값과 같아야 하객이
    // 붙여넣은 뒤 눈으로 대조할 수 있고, 은행 앱은 대부분 하이픈을 알아서 걷어낸다.
    const copied = await copyText(account.number);
    showToast(copied ? "계좌번호가 복사되었습니다" : "복사에 실패했어요\n계좌번호를 길게 눌러 주세요");
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "16px 0",
        borderTop: first ? "none" : "1px solid var(--input-border)",
      }}
    >
      <div>
        <div style={{ fontSize: scaled(15), color: "var(--text)" }}>
          <span style={{ fontSize: scaled(13.5), color: "var(--text-body)", marginRight: 6 }}>{role}</span>
          {account.holder}
        </div>
        {/* 은행과 번호는 한 줄에 둔다. 예전 --muted(#a7a496)는 카드 배경 위 2.5:1 이라 여기 쓸 수
            없었다. 2026-08-13 토큰 조정으로 그 색은 사라졌고, CI 의 axe 가 color-contrast 를
            실제로 검사한다(SIS-18). */}
        <div style={{ fontSize: scaled(14), color: "var(--text-body)", marginTop: 5 }}>
          {account.bank} {account.number}
        </div>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        // 버튼이 넷이라 이름이 모두 "복사"면 스크린리더로는 어느 계좌의 것인지 알 수 없다.
        aria-label={`${role} ${account.holder} 계좌번호 복사`}
        style={{
          flex: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "9px 14px",
          background: "var(--surface)",
          border: "1px solid var(--input-border)",
          borderRadius: 12,
          color: "var(--on-surface)",
          fontFamily: "var(--font-serif)",
          fontSize: scaled(12),
          cursor: "pointer",
        }}
      >
        <CopyIcon />
        복사
      </button>
    </div>
  );
}

/**
 * 아코디언 안에서 쓸 짧은 역할 이름을 만든다. "신랑 아버지" → "아버지".
 *
 * 이미 "신랑측" 아코디언 안이라 집안 이름이 한 번 더 나오면 군더더기다. 환경변수에
 * 어떻게 적혀 오든(`신랑 아버지` / `아버지`) 화면이 같아지도록 여기서 걷어낸다.
 * 본인 계좌의 `신랑`·`신부`는 뒤에 붙는 말이 없어 그대로 남는다.
 */
export function shortRole(role: string, side: "groom" | "bride"): string {
  return role.replace(side === "groom" ? /^신랑\s+/ : /^신부\s+/, "");
}

/** 복사 아이콘. 이것 하나 때문에 아이콘 라이브러리를 들이지 않는다. */
function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
