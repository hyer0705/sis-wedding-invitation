import { useRef, useState } from "react";
import { m } from "motion/react";
import { bgmUrl } from "../lib/bgm";

function SpeakerOnIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4 9.5h3.2L12 5.6v12.8l-4.8-3.9H4z" strokeLinejoin="round" />
      <path d="M15.4 9.8a3.4 3.4 0 0 1 0 4.4" strokeLinecap="round" />
      <path d="M18 7.4a7 7 0 0 1 0 9.2" strokeLinecap="round" />
    </svg>
  );
}

function SpeakerOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4 9.5h3.2L12 5.6v12.8l-4.8-3.9H4z" strokeLinejoin="round" />
      <path d="M15.8 10.2l4.4 4.4M20.2 10.2l-4.4 4.4" strokeLinecap="round" />
    </svg>
  );
}

export default function Bgm() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      audio.muted = true;
      setPlaying(false);
      return;
    }

    setPlaying(true);
    audio.muted = false;
    try {
      await audio.play();
    } catch {
      audio.pause();
      audio.muted = true;
      setPlaying(false);
    }
  }

  return (
    <div className="bgm">
      <audio ref={audioRef} src={bgmUrl()} loop muted={!playing} preload="none" data-testid="bgm-audio" />
      <m.button
        type="button"
        className="bgm-toggle"
        onClick={toggle}
        whileTap={{ scale: 0.94 }}
        aria-pressed={playing}
        aria-label="배경음악"
      >
        {playing ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
      </m.button>
    </div>
  );
}
