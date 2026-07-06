import { useEffect, useState } from "react";
import Reveal from "./Reveal";
import { INVITE } from "../invite";

function remaining() {
  const target = new Date(INVITE.dateISO).getTime();
  let diff = Math.max(0, target - Date.now());
  const days = Math.floor(diff / 86400000);
  diff -= days * 86400000;
  const hours = Math.floor(diff / 3600000);
  diff -= hours * 3600000;
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff - mins * 60000) / 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return { days, hours: p(hours), mins: p(mins), secs: p(secs) };
}

const boxStyle = { flex: 1, background: "var(--surface)", borderRadius: 16, padding: "16px 4px" } as const;
const numStyle = { fontSize: 28, fontWeight: 700, lineHeight: 1 } as const;
const labelStyle = { fontSize: 10.5, letterSpacing: "0.1em", color: "var(--muted-2)", marginTop: 8 } as const;

export default function DDay() {
  const [t, setT] = useState(remaining);

  useEffect(() => {
    const iv = setInterval(() => setT(remaining()), 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <Reveal>
      <div className="card">
        <div className="script-title" style={{ marginBottom: 26 }}>
          D-Day
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
          <div style={boxStyle}>
            <div style={numStyle}>{t.days}</div>
            <div style={labelStyle}>일</div>
          </div>
          <div style={boxStyle}>
            <div style={numStyle}>{t.hours}</div>
            <div style={labelStyle}>시</div>
          </div>
          <div style={boxStyle}>
            <div style={numStyle}>{t.mins}</div>
            <div style={labelStyle}>분</div>
          </div>
          <div style={{ ...boxStyle, background: "var(--primary)" }}>
            <div style={{ ...numStyle, color: "#fff" }}>{t.secs}</div>
            <div style={{ ...labelStyle, color: "#dfe6d6" }}>초</div>
          </div>
        </div>
        <p style={{ margin: "24px 0 0", fontSize: 14, color: "var(--text-sub)", lineHeight: 1.7 }}>
          {INVITE.groom.first}, {INVITE.bride.first}의 결혼식까지{" "}
          <span style={{ color: "var(--primary)", fontWeight: 700 }}>{t.days}</span>일
        </p>
      </div>
    </Reveal>
  );
}
