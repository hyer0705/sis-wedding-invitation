import { useEffect, useRef, useState } from "react";
import { m } from "motion/react";
import { bgmUrl } from "../lib/bgm";

const GESTURE_EVENTS = ["pointerdown", "touchend", "keydown"] as const;

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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const silence = () => {
      audio.pause();
      audio.muted = true;
    };

    if (!playing) {
      silence();
      return;
    }

    let cancelled = false;

    const start = async () => {
      audio.muted = false;
      try {
        await audio.play();
        return true;
      } catch {
        return false;
      }
    };

    const waitForGesture = () => {
      GESTURE_EVENTS.forEach((type) => document.addEventListener(type, onGesture));
    };

    const stopWaiting = () => {
      GESTURE_EVENTS.forEach((type) => document.removeEventListener(type, onGesture));
    };

    function onGesture(event: Event) {
      if (buttonRef.current?.contains(event.target as Node)) return;

      stopWaiting();
      void start().then((started) => {
        if (cancelled || started) return;
        silence();
        setPlaying(false);
      });
    }

    void start().then((started) => {
      if (cancelled || started) return;
      waitForGesture();
    });

    return () => {
      cancelled = true;
      stopWaiting();
    };
  }, [playing]);

  return (
    <>
      <audio ref={audioRef} src={bgmUrl()} loop preload="none" data-testid="bgm-audio" />
      <m.button
        ref={buttonRef}
        type="button"
        className="bgm-toggle"
        onClick={() => setPlaying((on) => !on)}
        whileTap={{ scale: 0.94 }}
        aria-pressed={playing}
        aria-label="배경음악"
      >
        {playing ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
      </m.button>
    </>
  );
}
