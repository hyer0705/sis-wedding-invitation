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

export default function Invitation() {
  return (
    <Reveal>
      <div className="card" style={{ padding: "46px 30px" }}>
        <div className="script-title" style={{ fontSize: 26 }}>
          Invitation
        </div>
        <div style={{ width: 34, height: 1, background: RULE_COLOR, margin: "18px auto 26px" }} />

        {INVITE.greeting.body.map((paragraph, index) => (
          <p
            key={paragraph}
            style={{
              margin: index === 0 ? 0 : "22px 0 0",
              fontSize: 16.5,
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
                fontSize: 15,
                lineHeight: 2.1,
                color: "var(--text-sub)",
                ...WRAP,
              }}
            >
              {stanza}
            </p>
          ))}
          {/* cite 의 기본 이탤릭은 명조 본문과 어울리지 않아 되돌린다. */}
          <cite style={{ display: "block", marginTop: 20, fontSize: 13, fontStyle: "normal", color: "var(--muted)" }}>
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
            fontSize: 15,
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
