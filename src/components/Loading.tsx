import { useEffect, useState } from "react";
import { m } from "motion/react";
import { imageSrcSet, imageUrl } from "../lib/imageUrl";
import { preloadImage } from "../lib/preloadImage";
import { COVER_NAME, COVER_SIZES } from "./Cover";

export const MIN_VISIBLE_MS = 500;

export const MAX_VISIBLE_MS = 4000;

const LABEL_ID = "loading-label";

const BOOT_ID = "boot";

export function removeBootScreen(): void {
  document.getElementById(BOOT_ID)?.remove();
}

export function useCoverReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const startedAt = Date.now();
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;

    const finish = () => {
      if (!cancelled) setReady(true);
    };

    timers.push(setTimeout(finish, MAX_VISIBLE_MS));

    void preloadImage(imageUrl(COVER_NAME, 960), imageSrcSet(COVER_NAME), COVER_SIZES).then(() => {
      timers.push(setTimeout(finish, Math.max(MIN_VISIBLE_MS - (Date.now() - startedAt), 0)));
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  return ready;
}

export default function Loading() {
  return (
    <m.div
      role="status"
      aria-labelledby={LABEL_ID}
      data-testid="loading"
      exit={{ opacity: 0, pointerEvents: "none" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{
        position: "fixed",
        inset: 0,
        maxWidth: "var(--page-max)",
        margin: "0 auto",
        zIndex: 100,
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 54,
      }}
    >
      <span id={LABEL_ID} className="sr-only">
        청첩장을 불러오는 중
      </span>
      <m.span
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        style={{ fontFamily: "var(--font-script)", fontSize: 30, color: "var(--primary)", lineHeight: 1 }}
      >
        The wedding of
      </m.span>
      <span
        aria-hidden="true"
        style={{ display: "block", marginTop: 20, width: 1, height: 44, background: "var(--input-border)" }}
      >
        <m.span
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 1.1, ease: [0.25, 0.6, 0.3, 1] }}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            background: "var(--primary)",
            opacity: 0.75,
            originY: 0,
          }}
        />
      </span>
    </m.div>
  );
}
