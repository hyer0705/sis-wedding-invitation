import Reveal from "./Reveal";
import { INVITE } from "../invite";

export default function Footer() {
  return (
    <Reveal>
      <footer style={{ padding: "42px 6px 64px", textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-script)", fontSize: 34, color: "var(--primary)", lineHeight: 1.3 }}>
          Thank you
          <br />
          for your love
        </div>
        <div style={{ width: 1, height: 34, background: "linear-gradient(#c6cdba, transparent)", margin: "22px auto" }} />
        <div style={{ fontSize: 14, color: "var(--text-sub)" }}>
          {INVITE.groom.name} · {INVITE.bride.name}
        </div>
        <div style={{ fontSize: 12, color: "#aab09e", marginTop: 8 }}>{INVITE.dateDots.replaceAll(" . ", ". ")}</div>
      </footer>
    </Reveal>
  );
}
