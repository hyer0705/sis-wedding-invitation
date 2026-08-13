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
        {/* 토큰 밖의 색(#aab09e)을 직접 적어 두었던 자리다. 배경 위 대비가 2.01 이라 AA 에
            한참 못 미쳤고, 토큰표에 없어 색감 일괄 변경에서도 빠졌다 (SIS-18). */}
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>{INVITE.dateDots.replaceAll(" . ", ". ")}</div>
      </footer>
    </Reveal>
  );
}
