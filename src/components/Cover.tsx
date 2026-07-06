import { m } from "motion/react";
import { INVITE } from "../invite";

export default function Cover() {
  return (
    <m.header
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.4 }}
      style={{ padding: "54px 26px 60px", textAlign: "center" }}
    >
      <div style={{ fontFamily: "var(--font-script)", fontSize: 30, color: "var(--primary)", lineHeight: 1 }}>The wedding of</div>
      <div
        style={{ marginTop: 10, fontFamily: "var(--font-caption)", fontSize: 11, letterSpacing: "0.4em", color: "var(--muted)" }}
      >
        {INVITE.dateDots}
      </div>
      <div
        style={{
          marginTop: 32,
          borderRadius: "200px 200px 18px 18px",
          overflow: "hidden",
          boxShadow: "0 24px 50px rgba(80, 95, 75, 0.2)",
        }}
      >
        <img
          src="/images/wedding_1-960.webp"
          alt="메인 사진"
          fetchPriority="high"
          style={{ width: "100%", aspectRatio: "4/5", objectFit: "cover", display: "block" }}
        />
      </div>
      <h1 style={{ margin: "30px 0 0", fontWeight: 700, fontSize: 30, letterSpacing: "0.06em" }}>
        {INVITE.groom.name} <span style={{ color: "var(--primary)", fontWeight: 400 }}>&amp;</span> {INVITE.bride.name}
      </h1>
      <div style={{ marginTop: 14, fontSize: 14, color: "var(--text-sub)", lineHeight: 1.7 }}>
        {INVITE.dayText}
        <br />
        {INVITE.venue} {INVITE.hall.split(" ")[0]}
      </div>
      <m.div
        animate={{ y: [0, 7, 0], opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        style={{ marginTop: 36, display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 7 }}
      >
        <span style={{ fontFamily: "var(--font-script)", fontSize: 17, color: "#a9b3a1" }}>scroll</span>
        <span style={{ fontSize: 15, color: "#bcc4b2" }}>↓</span>
      </m.div>
    </m.header>
  );
}
