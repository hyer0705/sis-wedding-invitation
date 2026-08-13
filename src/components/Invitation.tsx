import Reveal from "./Reveal";
import { INVITE } from "../invite";
import { formatParents } from "../lib/parents";

// IN-01 인사말 · IN-02 인용 문구 · IN-03 혼주 표기 · IN-04 고인 표기.
//
// c안에는 뒷문단을 감추는 「더보기」 버튼이 있었으나 두지 않는다(2026-08-11 확정).
// 받은 인사말이 네 문단으로 짧은 데다, 청첩 인사는 하객이 반드시 읽는 글이라 접을
// 이유가 없다. 갤러리의 더보기(GL-03)도 미채택이라 페이지에 이 패턴 자체가 없다.
//
// IN-02 인용구는 c안에 없던 항목이며 인사말 아래에 둔다.

// 고객이 지정한 줄바꿈(\n)을 그대로 살린다 — pre-line 이 개행만 보존하고 들여쓰기
// 공백은 합쳐 준다. keep-all 은 저절로 접히는 줄이 낱말 중간에서 갈라지지 않게 한다.
const WRAP = { whiteSpace: "pre-line", wordBreak: "keep-all" } as const;

const RULE_COLOR = "var(--input-border)";

// 이 카드만 본문을 c안 기준(16.5)보다 작게 쓴다. 받은 인사말에는 한 줄이 23자인
// 문단이 있어 16.5 로는 375px 에서 두 문단이 한 줄씩 더 접혔고, 마지막 낱말만
// 홀로 떨어져 고객이 지정한 줄바꿈이 무너졌다.
//
// 좌우 패딩을 30 에서 26 으로 4px 만 좁히고 실측했을 때, 375px 에서 모든 문단이
// 원문대로 앉는 최대 크기가 14.5 였다(패딩을 22 까지 줄여도 한계는 같아 더 깎지
// 않았다). 문구가 바뀌면 이 값도 다시 재야 한다.
//
// 줄 수를 세려면 실제 레이아웃이 있어야 해서 jsdom 으로는 볼 수 없다. 이 값들을
// 지키는 것은 e2e/smoke.spec.ts 이며, 320px 은 11.5px 이하라야 지켜져 제외했다.
const CARD_PADDING_X = 26;
const BODY_SIZE = 14.5;
const QUOTE_SIZE = 13.5;
const PARENTS_SIZE = 14;

export default function Invitation() {
  return (
    <Reveal>
      <div className="card" style={{ padding: `46px ${CARD_PADDING_X}px` }}>
        <div className="script-title" style={{ fontSize: 26 }}>
          Invitation
        </div>
        <div style={{ width: 34, height: 1, background: RULE_COLOR, margin: "18px auto 26px" }} />

        {INVITE.greeting.body.map((paragraph, index) => (
          <p
            key={paragraph}
            style={{
              margin: index === 0 ? 0 : "22px 0 0",
              fontSize: BODY_SIZE,
              lineHeight: 2.2,
              color: "var(--text-body)",
              ...WRAP,
            }}
          >
            {paragraph}
          </p>
        ))}

        <div style={{ width: 34, height: 1, background: RULE_COLOR, margin: "32px auto 28px" }} />

        <blockquote style={{ margin: 0 }}>
          {INVITE.greeting.quote.map((stanza, index) => (
            <p
              key={stanza}
              style={{
                margin: index === 0 ? 0 : "18px 0 0",
                fontSize: QUOTE_SIZE,
                lineHeight: 2.1,
                color: "var(--text-sub)",
                ...WRAP,
              }}
            >
              {stanza}
            </p>
          ))}
          {/* cite 의 기본 이탤릭은 명조 본문과 어울리지 않아 되돌린다.
              위계는 색이 아니라 크기로만 준다. 예전 --muted(#a7a496)는 카드 배경 위 2.5:1 이라
              이 크기에 쓸 수 없었고, 2026-08-13 토큰 조정 뒤에는 --text-sub 와 명도가 거의 같아져
              (4.66 대 4.64) 색으로는 위계가 생기지 않는다 — AA 바닥에 나란히 놓인 값들이다. */}
          <cite style={{ display: "block", marginTop: 20, fontSize: 12.5, fontStyle: "normal", color: "var(--text-sub)" }}>
            — {INVITE.greeting.quoteAuthor} —
          </cite>
        </blockquote>

        <div
          style={{
            marginTop: 36,
            paddingTop: 26,
            borderTop: `1px solid ${RULE_COLOR}`,
            display: "flex",
            flexDirection: "column",
            gap: 11,
            fontSize: PARENTS_SIZE,
            color: "var(--text-body)",
            wordBreak: "keep-all",
          }}
        >
          {[INVITE.groom, INVITE.bride].map((side) => (
            <div key={side.name}>
              {formatParents(side.parents)}
              <span style={{ color: "var(--primary)", margin: "0 7px", fontSize: 13 }}>의 {side.relation}</span>
              {side.first}
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  );
}
