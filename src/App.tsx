import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import Cover from "./components/Cover";
import Invitation from "./components/Invitation";
import Calendar from "./components/Calendar";
import Gallery from "./components/Gallery";
import Location from "./components/Location";
import Accounts from "./components/Accounts";
import Guestbook from "./components/Guestbook";
import GuestbookAll from "./components/GuestbookAll";
import Rsvp from "./components/rsvp/Rsvp";
import Share from "./components/Share";
import Footer from "./components/Footer";
import Loading, { removeBootScreen, useCoverReady } from "./components/Loading";
import Bgm from "./components/Bgm";
import { TextSizeBar } from "./components/TextSize";
import { currentRoute, subscribeRoute } from "./lib/navigation";

export default function App() {
  // CM-04 — 커버 사진이 도착할 때까지 로딩 화면이 덮는다. 그 아래 페이지는 그대로
  // 렌더되고 있어야 한다. 커버의 <img>가 붙어 있어야 사진 요청이 나가고, 로딩 화면은
  // 그 요청이 끝나기를 기다리기 때문이다.
  const ready = useCoverReady();

  // GB-03 — 방명록 전체보기(/guestbook)는 청첩장을 걷어내지 않고 그 위에 덮는다.
  // 걷어내면 돌아왔을 때 커버부터 다시 그려져 로딩 화면이 한 번 더 스치고, 보던
  // 자리도 잃는다. 덮어 두면 뒤쪽 스크롤이 그대로 남아 X 한 번에 원래 자리다.
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => subscribeRoute(setRoute), []);

  // 어느 경로로 들어왔든 이 자리에서 부트 화면을 걷는다. 로딩 화면 안에 두면 그것을
  // 띄우지 않는 경로에서 부트가 영영 남는다 (Loading.tsx 의 removeBootScreen 참고).
  useEffect(removeBootScreen, []);

  return (
    // has-bottom-bar 는 아래 TextSizeBar 가 덮는 만큼을 비워 둔다. 바가 없는 관리자
    // 화면도 .page 를 쓰므로 그쪽까지 여백이 붙지 않도록 클래스를 갈라 두었다.
    <div className="page has-bottom-bar">
      {/* 방명록 전체보기로 바로 들어온 경우에는 로딩 화면을 띄우지 않는다. 그 화면은
          커버 사진을 기다리는 것인데(z-index 100), 방명록(80) 위를 덮어 버려 하객이
          받은 링크를 열면 읽으려던 글 대신 로딩 화면을 마주하게 된다. 커버는 그 뒤에서
          그대로 받아 두므로 X 로 돌아오면 이미 준비돼 있다. */}
      <AnimatePresence>{!ready && route !== "guestbook" && <Loading key="loading" />}</AnimatePresence>
      <div className="floating-controls">
        <Bgm />
      </div>
      {/* 로딩이 걷힌 시점을 커버도 알아야 한다 — 그때까지 사진이 안 온 경우에만 페이드로 얹는다 (SIS-29) */}
      <Cover coverReady={ready} />
      <Invitation />
      {/* Calendar 가 예식 일시·장소·달력·D-Day 를 함께 담는다 (SIS-10) */}
      <Calendar />
      <Gallery />
      <Location />
      {/* RSVP 가 마음전하기 위다 (2026-08-24 고객 요청). 참석 여부를 먼저 묻고 계좌를
          그 뒤에 두는 순서이며, 이 이동으로 마음전하기와 방명록이 붙는다 */}
      <Rsvp />
      <Accounts />
      {/* 방명록은 「마음전하기」 바로 다음이다 (2026-08-24 고객 확정, SIS-21) */}
      <Guestbook />
      {/* 공유 버튼은 푸터 위다 — 청첩장을 다 읽은 뒤에 "전해 주세요"가 나온다 (SIS-16) */}
      <Share />
      <Footer />
      {/* 글자 크기 바는 화면 아래에 붙박이로 선다 (2026-09-01). 아이콘으로 두었더니
          정작 이 기능이 필요한 하객이 눌러 볼 생각을 하지 않았다 — components/TextSize.tsx 머리말 */}
      <TextSizeBar />
      {route === "guestbook" && <GuestbookAll />}
    </div>
  );
}
