import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import Cover from "./components/Cover";
import Invitation from "./components/Invitation";
import Calendar from "./components/Calendar";
import Gallery from "./components/Gallery";
import Location from "./components/Location";
import Notice from "./components/Notice";
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
  const ready = useCoverReady();

  const [route, setRoute] = useState(currentRoute);
  useEffect(() => subscribeRoute(setRoute), []);

  useEffect(removeBootScreen, []);

  return (
    <div className="page has-bottom-bar">
      <AnimatePresence>{!ready && route !== "guestbook" && <Loading key="loading" />}</AnimatePresence>
      <div className="floating-controls">
        <Bgm />
      </div>
      <Cover coverReady={ready} />
      <Invitation />
      <Calendar />
      <Gallery />
      <Location />
      <Notice />
      <Rsvp />
      <Accounts />
      <Guestbook />
      <Share />
      <Footer />
      <TextSizeBar />
      {route === "guestbook" && <GuestbookAll />}
    </div>
  );
}
