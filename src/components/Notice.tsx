import Reveal from "./Reveal";
import { INVITE } from "../invite";
import { scaled } from "../lib/typeScale";

const RULE_COLOR = "var(--input-border)";

export default function Notice() {
  if (INVITE.notices.length === 0) return null;

  return (
    <Reveal>
      <div data-testid="notice" className="card" style={{ padding: "38px 26px", textAlign: "center" }}>
        <div className="script-title">Notice</div>
        <div style={{ width: 34, height: 1, background: RULE_COLOR, margin: "18px auto 24px" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {INVITE.notices.map((lines) => (
            <p
              key={lines.join(" ")}
              style={{
                margin: 0,
                fontSize: scaled(14.5),
                lineHeight: 2,
                color: "var(--text-body)",
                wordBreak: "keep-all",
              }}
            >
              {lines.map((line, index) => (
                <span key={line} className="notice-line">
                  {index === lines.length - 1 ? line : `${line} `}
                </span>
              ))}
            </p>
          ))}
        </div>
      </div>
    </Reveal>
  );
}
