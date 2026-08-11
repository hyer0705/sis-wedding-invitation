import Cover from "./components/Cover";
import Invitation from "./components/Invitation";
import Calendar from "./components/Calendar";
import Gallery from "./components/Gallery";
import Location from "./components/Location";
import Accounts from "./components/Accounts";
import Rsvp from "./components/Rsvp";
import Footer from "./components/Footer";

export default function App() {
  return (
    <div className="page">
      <Cover />
      <Invitation />
      {/* Calendar 가 예식 일시·장소·달력·D-Day 를 함께 담는다 (SIS-10) */}
      <Calendar />
      <Gallery />
      <Location />
      <Accounts />
      <Rsvp />
      <Footer />
    </div>
  );
}
