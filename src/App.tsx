import { AnimatePresence } from "motion/react";
import Cover from "./components/Cover";
import Invitation from "./components/Invitation";
import Calendar from "./components/Calendar";
import Gallery from "./components/Gallery";
import Location from "./components/Location";
import Accounts from "./components/Accounts";
import Rsvp from "./components/Rsvp";
import Share from "./components/Share";
import Footer from "./components/Footer";
import Loading, { useCoverReady } from "./components/Loading";

export default function App() {
  // CM-04 — 커버 사진이 도착할 때까지 로딩 화면이 덮는다. 그 아래 페이지는 그대로
  // 렌더되고 있어야 한다. 커버의 <img>가 붙어 있어야 사진 요청이 나가고, 로딩 화면은
  // 그 요청이 끝나기를 기다리기 때문이다.
  const ready = useCoverReady();

  return (
    <div className="page">
      <AnimatePresence>{!ready && <Loading key="loading" />}</AnimatePresence>
      {/* 로딩이 걷힌 시점을 커버도 알아야 한다 — 그때까지 사진이 안 온 경우에만 페이드로 얹는다 (SIS-29) */}
      <Cover coverReady={ready} />
      <Invitation />
      {/* Calendar 가 예식 일시·장소·달력·D-Day 를 함께 담는다 (SIS-10) */}
      <Calendar />
      <Gallery />
      <Location />
      <Accounts />
      {/* RSVP 를 되살렸다 (SIS-15). v1 에서 뺀 것은 구현이 스텁이었기 때문이고,
          개인정보 동의 문구(RS-03) 고객 확정본을 받아 폼을 채웠다 (2026-08-18).
          ⚠ 전송은 아직 연결되지 않았다 — SIS-20 이 lib/rsvp.ts 의 submitRsvp 를 채운다 */}
      <Rsvp />
      {/* 공유 버튼은 푸터 위다 — 청첩장을 다 읽은 뒤에 "전해 주세요"가 나온다 (SIS-16) */}
      <Share />
      <Footer />
    </div>
  );
}
