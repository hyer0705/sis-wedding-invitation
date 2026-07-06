import Reveal from "./Reveal";
import { INVITE } from "../invite";

export default function Location() {
  return (
    <Reveal>
      <div className="card" style={{ padding: "38px 26px" }}>
        <div className="script-title">Location</div>
        <div style={{ fontSize: 17, fontWeight: 700, marginTop: 10 }}>
          {INVITE.venue} {INVITE.hall.split(" ")[0]}
        </div>
        <div style={{ fontSize: 14, color: "var(--text-sub)", marginTop: 6 }}>{INVITE.address}</div>
        <p className="todo">카카오맵 임베드 + 지도 앱 링크 3종 + 주소 복사 이식 예정</p>
      </div>
    </Reveal>
  );
}
