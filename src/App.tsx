import Cover from "./components/Cover";
import Invitation from "./components/Invitation";
import Details from "./components/Details";
import DDay from "./components/DDay";
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
      <Details />
      <DDay />
      <Gallery />
      <Location />
      <Accounts />
      <Rsvp />
      <Footer />
    </div>
  );
}
