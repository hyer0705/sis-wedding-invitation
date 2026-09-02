import Reveal from "./Reveal";
import { INVITE } from "../invite";
import { parentNameLines } from "../lib/parents";
import { scaled } from "../lib/typeScale";

const WRAP = { whiteSpace: "pre-line", wordBreak: "keep-all" } as const;

const RULE_COLOR = "var(--input-border)";

const CARD_PADDING_X = 26;
const BODY_SIZE = scaled(14.5);
const PARENTS_SIZE = scaled(14);
const PARENTS_LINE_HEIGHT = 1.85;

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

        <div
          style={{
            marginTop: 36,
            paddingTop: 26,
            borderTop: `1px solid ${RULE_COLOR}`,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            fontSize: PARENTS_SIZE,
            color: "var(--text-body)",
            wordBreak: "keep-all",
          }}
        >
          {[INVITE.groom, INVITE.bride].map((side) => (
            <div key={side.name} style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 7 }}>
              <span
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  lineHeight: PARENTS_LINE_HEIGHT,
                }}
              >
                {parentNameLines(side.parents).map((name) => (
                  <span key={name}>{name}</span>
                ))}
              </span>
              <span style={{ color: "var(--primary)", fontSize: scaled(13) }}>의 {side.relation}</span>
              <span>{side.first}</span>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  );
}
