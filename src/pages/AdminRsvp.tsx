import { useCallback, useEffect, useId, useMemo, useState } from "react";
import AdminConfirmDialog from "../components/AdminConfirmDialog";
import { deleteRsvp, listRsvp, summarize, type RsvpRow } from "../lib/adminRsvp";
import { formatKst, formatPhone, rsvpCsvBlob, rsvpCsvFileName } from "../lib/csv";
import {
  countByAttend,
  countBySide,
  EMPTY_FILTER,
  filterRsvp,
  isFiltered,
  type AttendFilter,
  type RsvpFilter,
  type SideFilter,
} from "../lib/rsvpFilter";

const ATTEND_TABS: AttendFilter[] = ["전체", "참석", "미참석"];
const SIDE_TABS: SideFilter[] = ["양가", "신랑측", "신부측"];

export default function AdminRsvp({ onCount }: { onCount?: (count: number) => void }) {
  const [rows, setRows] = useState<RsvpRow[]>();
  const [loadError, setLoadError] = useState("");
  const [loadedAt, setLoadedAt] = useState("");
  const [filter, setFilter] = useState<RsvpFilter>(EMPTY_FILTER);
  const [pending, setPending] = useState<RsvpRow>();
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const data = await listRsvp();
        if (!alive) return;
        setRows(data);
        setLoadedAt(new Date().toISOString());
      } catch (cause) {
        if (!alive) return;
        setLoadError(cause instanceof Error ? cause.message : "회신을 불러오지 못했습니다");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (rows) onCount?.(rows.length);
  }, [rows, onCount]);

  const visible = useMemo(() => (rows ? filterRsvp(rows, filter) : []), [rows, filter]);
  const total = useMemo(() => (rows ? summarize(rows) : undefined), [rows]);
  const shown = useMemo(() => summarize(visible), [visible]);
  const attendCounts = useMemo(() => (rows ? countByAttend(rows) : undefined), [rows]);
  const sideCounts = useMemo(() => (rows ? countBySide(rows) : undefined), [rows]);

  const removeRow = useCallback((id: string) => {
    setRows((current) => current?.filter((row) => row.id !== id));
  }, []);

  if (loadError) {
    return (
      <div className="admin-card">
        <p className="admin-empty">
          <strong>회신을 불러오지 못했습니다</strong>
        </p>
        <p className="admin-error" role="alert">
          {loadError}
        </p>
      </div>
    );
  }

  if (!rows || !total || !attendCounts || !sideCounts) {
    return (
      <div className="admin-card">
        <p className="admin-empty">회신을 불러오는 중입니다…</p>
      </div>
    );
  }

  return (
    <>
      <Summary summary={total} loadedAt={loadedAt} />

      <Download rows={rows} />

      <Filters
        filter={filter}
        onChange={setFilter}
        attendCounts={attendCounts}
        sideCounts={sideCounts}
        disabled={rows.length === 0}
      />

      {isFiltered(filter) && (
        <div className="admin-result">
          <span>
            {shown.responses}건 — 인원 {shown.headcount}명
          </span>
          <button type="button" className="admin-linkish" onClick={() => setFilter(EMPTY_FILTER)}>
            필터 해제
          </button>
        </div>
      )}

      {actionError && (
        <p className="admin-error" role="alert">
          {actionError}
        </p>
      )}

      <RsvpList rows={visible} total={rows.length} filter={filter} onDelete={setPending} />

      {pending && (
        <ConfirmDelete
          row={pending}
          onClose={() => setPending(undefined)}
          onDone={(id) => {
            removeRow(id);
            setPending(undefined);
            setActionError("");
          }}
          onError={setActionError}
        />
      )}
    </>
  );
}

function Summary({ summary, loadedAt }: { summary: ReturnType<typeof summarize>; loadedAt: string }) {
  return (
    <section className="admin-card" aria-labelledby="admin-summary-title">
      <div className="admin-sum-head">
        <h2 id="admin-summary-title">회신 집계</h2>
        {loadedAt && <span className="admin-stamp">{formatKst(loadedAt)} 기준</span>}
      </div>

      <dl className="admin-headcount">
        <dt>참석 인원</dt>
        <dd>
          {summary.headcount}
          <small>명</small>
        </dd>
      </dl>

      <dl className="admin-facing">
        <div className="admin-facing-side">
          <dt>신랑측</dt>
          <dd>
            {summary.sideHeadcount.신랑측}
            <small>명</small>
            <span className="admin-facing-sub">{summary.side.신랑측}건</span>
          </dd>
        </div>
        <div className="admin-facing-side">
          <dt>신부측</dt>
          <dd>
            {summary.sideHeadcount.신부측}
            <small>명</small>
            <span className="admin-facing-sub">{summary.side.신부측}건</span>
          </dd>
        </div>
      </dl>

      <dl className="admin-stat-grid">
        <div className="admin-stat">
          <dt>식사함</dt>
          <dd>{summary.meals.식사함}</dd>
        </div>
        <div className="admin-stat">
          <dt>식사안함</dt>
          <dd>{summary.meals.식사안함}</dd>
        </div>
        <div className="admin-stat">
          <dt>미정</dt>
          <dd>{summary.meals.미정}</dd>
        </div>
      </dl>

      <hr className="admin-rule" />

      <p className="admin-tally">
        <span>회신 {summary.responses}건</span>
        <span>
          참석 {summary.attending}
          <em>미참석 {summary.absent}</em>
        </span>
      </p>
    </section>
  );
}

function Download({ rows }: { rows: readonly RsvpRow[] }) {
  const [error, setError] = useState("");
  const noteId = useId();

  function download() {
    try {
      const url = URL.createObjectURL(rsvpCsvBlob(rows));
      const link = document.createElement("a");
      link.href = url;
      link.download = rsvpCsvFileName();

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "내려받기에 실패했습니다");
    }
  }

  return (
    <div className="admin-download">
      <button
        type="button"
        className="admin-btn admin-btn-soft"
        onClick={download}
        disabled={rows.length === 0}
        aria-describedby={noteId}
      >
        CSV 내려받기 ({rows.length}건)
      </button>
      <p id={noteId} className="admin-privacy-note">
        이 파일에는 하객의 이름과 연락처가 들어 있습니다. 공용 PC 나 대화방에 남지 않도록 주의해 주세요.
      </p>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Filters({
  filter,
  onChange,
  attendCounts,
  sideCounts,
  disabled,
}: {
  filter: RsvpFilter;
  onChange: (filter: RsvpFilter) => void;
  attendCounts: Record<AttendFilter, number>;
  sideCounts: Record<SideFilter, number>;
  disabled: boolean;
}) {
  const searchId = useId();

  if (disabled) return null;

  return (
    <fieldset className="admin-filters">
      <legend className="sr-only">회신 목록 거르기</legend>

      <div className="admin-seg">
        {ATTEND_TABS.map((value) => (
          <button
            key={value}
            type="button"
            className="admin-seg-btn"
            aria-pressed={filter.attend === value}
            onClick={() => onChange({ ...filter, attend: value })}
          >
            {value} {attendCounts[value]}
          </button>
        ))}
      </div>

      <div className="admin-seg">
        {SIDE_TABS.map((value) => (
          <button
            key={value}
            type="button"
            className="admin-seg-btn"
            aria-pressed={filter.side === value}
            onClick={() => onChange({ ...filter, side: value })}
          >
            {value} {sideCounts[value]}
          </button>
        ))}
      </div>

      <label className="sr-only" htmlFor={searchId}>
        이름이나 연락처로 검색
      </label>
      <input
        id={searchId}
        className="admin-search"
        type="search"
        placeholder="이름이나 연락처로 검색"
        value={filter.query}
        onChange={(event) => onChange({ ...filter, query: event.target.value })}
      />
    </fieldset>
  );
}

function RsvpList({
  rows,
  total,
  filter,
  onDelete,
}: {
  rows: readonly RsvpRow[];
  total: number;
  filter: RsvpFilter;
  onDelete: (row: RsvpRow) => void;
}) {
  if (total === 0) {
    return (
      <div className="admin-card">
        <p className="admin-empty">아직 회신이 없습니다.</p>
      </div>
    );
  }

  if (rows.length === 0) {
    const query = filter.query.trim();
    return (
      <div className="admin-card">
        <p className="admin-empty">{query ? `‘${query}’와 맞는 회신이 없습니다.` : "조건에 맞는 회신이 없습니다."}</p>
      </div>
    );
  }

  return (
    <ul className="admin-rows">
      {rows.map((row) => (
        <li key={row.id} className="admin-row">
          <span className={`admin-rail${row.side === "신부측" ? " admin-rail-bride" : ""}`} aria-hidden="true" />
          <div className="admin-row-body">
            <div className="admin-row-top">
              <span className="admin-row-name">{row.name}</span>
              <span className={`admin-badge ${row.attend === "참석" ? "admin-badge-yes" : "admin-badge-no"}`}>{row.attend}</span>
            </div>

            <p className="admin-row-meta">
              <span>{row.side}</span>
              {row.attend === "참석" && (
                <>
                  <span>{row.count}명</span>
                  <span>{row.meal}</span>
                </>
              )}
              <span>{formatPhone(row.phone)}</span>
            </p>

            <div className="admin-row-foot">
              <span>{formatKst(row.created_at)}</span>
              <button type="button" className="admin-row-del" onClick={() => onDelete(row)}>
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
  row,
  onClose,
  onDone,
  onError,
}: {
  row: RsvpRow;
  onClose: () => void;
  onDone: (id: string) => void;
  onError: (message: string) => void;
}) {
  return (
    <AdminConfirmDialog
      title="이 회신을 지울까요?"
      confirmLabel="삭제"
      runningLabel="지우는 중…"
      fallbackError="회신을 지우지 못했습니다"
      onClose={onClose}
      onError={onError}
      onConfirm={async () => {
        await deleteRsvp(row.id);
        onDone(row.id);
      }}
    >
      <p className="admin-dialog-who">
        <strong>
          {row.side} {row.name}
        </strong>
        <span>
          {row.attend}
          {row.attend === "참석" && ` ${row.count}명`}
        </span>
      </p>

      <p>지운 회신은 되돌릴 수 없습니다.</p>
    </AdminConfirmDialog>
  );
}
