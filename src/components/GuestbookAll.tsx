import { useEffect } from "react";
import { createPortal } from "react-dom";
import GuestbookList from "./GuestbookList";
import { useGuestbookFeed } from "./useGuestbookFeed";
import { useToast } from "./Toast";
import { PAGE_SIZE } from "../lib/guestbook";
import { closeGuestbook } from "../lib/navigation";

const TITLE = "Guest book";
const CLOSE_LABEL = "청첩장으로 돌아가기";
const MORE_LABEL = "더보기";
const EMPTY = "아직 남겨진 축하 메시지가 없어요";
const FAILED = "축하 메시지를 불러오지 못했어요\n잠시 뒤 다시 열어 주세요";
const MORE_FAILED = "더 불러오지 못했어요\n잠시 뒤 다시 시도해 주세요";

export default function GuestbookAll() {
  const { entries, state, hasMore, loadingMore, loadMore, forgetEntry } = useGuestbookFeed(PAGE_SIZE);
  const showToast = useToast();

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeGuestbook();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const showMore = async () => {
    if (!(await loadMore())) showToast(MORE_FAILED);
  };

  return createPortal(
    <div className="gb-page">
      <div className="gb-page-column">
        <div className="gb-page-bar">
          <h1 className="script-title" style={{ flexGrow: 1, margin: 0, fontSize: 22, fontWeight: 400 }}>
            {TITLE}
          </h1>
          <button type="button" className="gb-page-close" onClick={closeGuestbook} aria-label={CLOSE_LABEL}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M6 6 L18 18 M18 6 L6 18" />
            </svg>
          </button>
        </div>

        <div style={{ padding: 20 }}>
          <div className="card" style={{ padding: "8px 26px 30px" }}>
            {state === "failed" && <p className="gb-note">{FAILED}</p>}
            {state === "ready" && entries.length === 0 && <p className="gb-note">{EMPTY}</p>}
            {entries.length > 0 && <GuestbookList entries={entries} onDeleted={forgetEntry} />}

            {hasMore && (
              <button
                type="button"
                className="gb-btn"
                style={{ width: "100%", marginTop: 30 }}
                onClick={showMore}
                disabled={loadingMore}
              >
                {loadingMore ? "불러오는 중…" : MORE_LABEL}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
