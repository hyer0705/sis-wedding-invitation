import { useState } from "react";
import { AnimatePresence } from "motion/react";
import GuestbookDeleteDialog from "./GuestbookDeleteDialog";
import type { GuestbookEntry } from "../lib/guestbook";

const LIST_LABEL = "남겨 주신 축하 메시지";

const DATE_FORMAT = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Seoul",
});

export function formatEntryDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso)).replace(/\.$/, "");
}

export default function GuestbookList({
  entries,
  onDeleted,
}: {
  entries: readonly GuestbookEntry[];
  onDeleted: (id: string) => void;
}) {
  const [target, setTarget] = useState<GuestbookEntry | null>(null);

  return (
    <>
      <ul className="gb-list" aria-label={LIST_LABEL}>
        {entries.map((entry) => (
          <li key={entry.id}>
            <div className="heart-rule" aria-hidden="true">
              <svg width="13" height="12" viewBox="0 0 14 13" fill="currentColor">
                <path d="M7 12.2 1.7 7.1A3.4 3.4 0 0 1 7 2.8a3.4 3.4 0 0 1 5.3 4.3L7 12.2Z" />
              </svg>
            </div>

            <p className="gb-message">{entry.message}</p>

            <div className="gb-meta">
              <span className="gb-name">{entry.name}</span>
              <span className="gb-date">{formatEntryDate(entry.createdAt)}</span>
              <button
                type="button"
                className="gb-remove"
                onClick={() => setTarget(entry)}
                aria-label={`${entry.name} 님이 남긴 메시지 지우기`}
              >
                삭제
              </button>
            </div>
          </li>
        ))}
      </ul>

      <AnimatePresence>
        {target && (
          <GuestbookDeleteDialog
            key="gb-delete"
            entry={target}
            onClose={() => setTarget(null)}
            onDeleted={(id) => {
              setTarget(null);
              onDeleted(id);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
