import { useEffect, useId, useMemo, useState } from "react";
import AdminConfirmDialog from "./AdminConfirmDialog";
import { deleteGuestbookAsAdmin, filterGuestbook, listGuestbook } from "../lib/adminGuestbook";
import { formatKst } from "../lib/csv";
import type { GuestbookEntry } from "../lib/guestbook";

const PREVIEW_MAX = 80;

function preview(message: string): string {
  const letters = [...message];
  return letters.length > PREVIEW_MAX ? `${letters.slice(0, PREVIEW_MAX).join("")}…` : message;
}

export default function AdminGuestbook() {
  const [entries, setEntries] = useState<GuestbookEntry[]>();
  const [loadError, setLoadError] = useState("");
  const [loadedAt, setLoadedAt] = useState("");
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<GuestbookEntry>();
  const [actionError, setActionError] = useState("");
  const titleId = useId();
  const searchId = useId();

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const data = await listGuestbook();
        if (!alive) return;
        setEntries(data);
        setLoadedAt(new Date().toISOString());
      } catch (cause) {
        if (!alive) return;
        setLoadError(cause instanceof Error ? cause.message : "방명록을 불러오지 못했습니다");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const visible = useMemo(() => (entries ? filterGuestbook(entries, query) : []), [entries, query]);
  const searching = query.trim() !== "";

  if (loadError) {
    return (
      <div className="admin-card">
        <p className="admin-empty">
          <strong>방명록을 불러오지 못했습니다</strong>
        </p>
        <p className="admin-error" role="alert">
          {loadError}
        </p>
      </div>
    );
  }

  if (!entries) {
    return (
      <div className="admin-card">
        <p className="admin-empty">방명록을 불러오는 중입니다…</p>
      </div>
    );
  }

  return (
    <>
      <section className="admin-card" aria-labelledby={titleId}>
        <div className="admin-sum-head">
          <h2 id={titleId}>방명록</h2>
          {loadedAt && <span className="admin-stamp">{formatKst(loadedAt)} 기준</span>}
        </div>

        <dl className="admin-headcount">
          <dt>남겨 주신 메시지</dt>
          <dd>
            {entries.length}
            <small>건</small>
          </dd>
        </dl>
      </section>

      {entries.length > 0 && (
        <div className="admin-filters">
          <label className="sr-only" htmlFor={searchId}>
            이름이나 내용으로 검색
          </label>
          <input
            id={searchId}
            className="admin-search"
            type="search"
            placeholder="이름이나 내용으로 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      )}

      {searching && (
        <div className="admin-result">
          <span>{visible.length}건</span>
          <button type="button" className="admin-linkish" onClick={() => setQuery("")}>
            검색 지우기
          </button>
        </div>
      )}

      {actionError && (
        <p className="admin-error" role="alert">
          {actionError}
        </p>
      )}

      <GuestbookRows entries={visible} total={entries.length} query={query} onDelete={setPending} />

      {pending && (
        <ConfirmDelete
          entry={pending}
          onClose={() => setPending(undefined)}
          onDone={(id) => {
            setEntries((current) => current?.filter((entry) => entry.id !== id));
            setPending(undefined);
            setActionError("");
          }}
          onError={setActionError}
        />
      )}
    </>
  );
}

function GuestbookRows({
  entries,
  total,
  query,
  onDelete,
}: {
  entries: readonly GuestbookEntry[];
  total: number;
  query: string;
  onDelete: (entry: GuestbookEntry) => void;
}) {
  if (total === 0) {
    return (
      <div className="admin-card">
        <p className="admin-empty">아직 남겨 주신 메시지가 없습니다.</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="admin-card">
        <p className="admin-empty">‘{query.trim()}’ 검색 결과가 없습니다.</p>
      </div>
    );
  }

  return (
    <ul className="admin-rows">
      {entries.map((entry) => (
        <li key={entry.id} className="admin-row">
          <span className="admin-rail" aria-hidden="true" />
          <div className="admin-row-body">
            <div className="admin-row-top">
              <span className="admin-row-name">{entry.name}</span>
            </div>

            <p className="admin-gb-message">{entry.message}</p>

            <div className="admin-row-foot">
              <span>{formatKst(entry.createdAt)}</span>
              <button
                type="button"
                className="admin-row-del"
                onClick={() => onDelete(entry)}
                aria-label={`${entry.name} 님이 남긴 메시지 삭제`}
              >
                삭제
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ConfirmDelete({
  entry,
  onClose,
  onDone,
  onError,
}: {
  entry: GuestbookEntry;
  onClose: () => void;
  onDone: (id: string) => void;
  onError: (message: string) => void;
}) {
  return (
    <AdminConfirmDialog
      title="이 메시지를 지울까요?"
      confirmLabel="삭제"
      runningLabel="지우는 중…"
      fallbackError="메시지를 지우지 못했습니다"
      onClose={onClose}
      onError={onError}
      onConfirm={async () => {
        await deleteGuestbookAsAdmin(entry.id);
        onDone(entry.id);
      }}
    >
      <p className="admin-dialog-who">
        <strong>{entry.name}</strong>
        <span>{formatKst(entry.createdAt)}</span>
      </p>

      <p className="admin-gb-quote">{preview(entry.message)}</p>

      <p>지운 메시지는 되돌릴 수 없습니다. 남긴 분에게는 따로 알려지지 않습니다.</p>
    </AdminConfirmDialog>
  );
}
