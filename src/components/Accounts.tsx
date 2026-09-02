import { useId, useState } from "react";
import Reveal from "./Reveal";
import { useToast } from "./Toast";
import { INVITE } from "../invite";
import { copyText } from "../lib/clipboard";
import type { Account } from "../lib/private-data";
import { scaled } from "../lib/typeScale";

const LEAD = "참석이 어려우신 분들을 위해\n마음 전하실 곳을 안내드립니다.";

export default function Accounts() {
  if (INVITE.accounts.groom.length === 0 && INVITE.accounts.bride.length === 0) return null;

  return (
    <Reveal>
      <div className="card" style={{ padding: "38px 26px", textAlign: "center" }}>
        <div className="script-title">Thanks heart</div>
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

function AccountGroup({ side, label, accounts }: { side: "groom" | "bride"; label: string; accounts: readonly Account[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (accounts.length === 0) return null;

  return (
    <div style={{ border: "1px solid var(--surface-2)", borderRadius: 16, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
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
        <div style={{ fontSize: scaled(14), color: "var(--text-body)", marginTop: 5 }}>
          {account.bank} {account.number}
        </div>
      </div>

      <button
        type="button"
        onClick={handleCopy}
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

export function shortRole(role: string, side: "groom" | "bride"): string {
  return role.replace(side === "groom" ? /^신랑\s+/ : /^신부\s+/, "");
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
