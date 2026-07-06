import Reveal from "./Reveal";
import { INVITE } from "../invite";

export default function Details() {
  return (
    <Reveal>
      <div
        className="card"
        style={{
          background: "var(--primary)",
          color: "var(--on-primary)",
          padding: "44px 30px",
          boxShadow: "var(--shadow-green-card)",
        }}
      >
        <div className="script-title" style={{ fontSize: 25, color: "var(--on-primary-title)" }}>
          When &amp; Where
        </div>
        <div style={{ fontSize: 27, fontWeight: 700, marginTop: 18, letterSpacing: "0.03em" }}>{INVITE.dateText}</div>
        <div style={{ fontSize: 15, color: "var(--on-primary-sub)", marginTop: 8 }}>{INVITE.dayText}</div>
        <div style={{ width: 30, height: 1, background: "rgba(247, 248, 241, 0.5)", margin: "26px auto" }} />
        <div style={{ fontSize: 18, fontWeight: 700 }}>{INVITE.venue}</div>
        <div style={{ fontSize: 14, color: "var(--on-primary-sub)", marginTop: 6 }}>{INVITE.hall}</div>
      </div>
    </Reveal>
  );
}
