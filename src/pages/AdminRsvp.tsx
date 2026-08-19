// SIS-38 — 관리자 화면의 회신 탭. AD-01 · RS-04. 시안 확정 2026-08-19.
//
// 이 화면에는 하객의 **이름과 연락처**가 실린다. 두 가지를 지킨다.
//   1. 내려받기 버튼 옆에 무엇이 든 파일인지 적는다
//   2. 오류 메시지·로그에 회신 내용을 싣지 않는다 (rsvp.ts 의 submitRsvp 와 같은 이유)
//
// **필터는 목록만 좁힌다.** 집계와 CSV 는 늘 전체를 본다 — 거른 상태로 내려받은
// 파일을 전체로 착각하면 식수를 잘못 주문한다(rsvpFilter.ts 머리말).
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
        onCount?.(data.length);
      } catch (cause) {
        if (!alive) return;
        setLoadError(cause instanceof Error ? cause.message : "회신을 불러오지 못했습니다");
      }
    })();

    return () => {
      alive = false;
    };
  }, [onCount]);

  const visible = useMemo(() => (rows ? filterRsvp(rows, filter) : []), [rows, filter]);
  const total = useMemo(() => (rows ? summarize(rows) : undefined), [rows]);
  const shown = useMemo(() => summarize(visible), [visible]);
  const attendCounts = useMemo(() => (rows ? countByAttend(rows) : undefined), [rows]);
  const sideCounts = useMemo(() => (rows ? countBySide(rows) : undefined), [rows]);

  const removeRow = useCallback(
    (id: string) => {
      setRows((current) => {
        const next = current?.filter((row) => row.id !== id);
        if (next) onCount?.(next.length);
        return next;
      });
    },
    [onCount],
  );

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

/** 집계 (RS-04). 식수 조율이 이 화면의 첫 용도라 목록보다 위에 둔다. */
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

      {/* 양가는 색이 아니라 가운데 선으로 가른다 — 이유는 admin.css 의 .admin-facing 참고 */}
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

/**
 * CSV 내려받기 (RS-04).
 *
 * **거른 목록이 아니라 전체를 싣는다.** 화면에서 참석만 보고 있다가 내려받은 파일에
 * 미참석이 빠져 있으면, 그 파일을 명단으로 쓰는 쪽은 알아챌 방법이 없다.
 */
function Download({ rows }: { rows: readonly RsvpRow[] }) {
  const [error, setError] = useState("");
  const noteId = useId();

  function download() {
    try {
      const url = URL.createObjectURL(rsvpCsvBlob(rows));
      const link = document.createElement("a");
      link.href = url;
      link.download = rsvpCsvFileName();
      link.click();
      // 곧바로 걷으면 사파리에서 저장이 시작되기 전에 주소가 사라진다.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (cause) {
      // 회신 내용은 싣지 않는다 — 실패한 것은 파일을 만드는 일이다.
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
          {/* 띠는 거들 뿐이다 — 「신랑측」 글자가 아래 줄에 늘 함께 있다 */}
          <span className={`admin-rail${row.side === "신부측" ? " admin-rail-bride" : ""}`} aria-hidden="true" />
          <div className="admin-row-body">
            <div className="admin-row-top">
              <span className="admin-row-name">{row.name}</span>
              <span className={`admin-badge ${row.attend === "참석" ? "admin-badge-yes" : "admin-badge-no"}`}>{row.attend}</span>
            </div>

            <p className="admin-row-meta">
              <span>{row.side}</span>
              {/* 미참석 회신의 인원·식사는 자리표시 값이라 보여 주지 않는다
                  (adminRsvp.ts 의 summarize 주석) */}
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

/**
 * 삭제 확인 팝업. 제출 확인 팝업(.rsvp-confirm, SIS-36)과 같은 꼴로 만든다.
 *
 * body 에 직접 그린다 — 조상에 걸린 transform 이 position:fixed 의 기준이 되는 것을
 * 피하기 위해서다(Rsvp.tsx 의 ConfirmDialog 와 같은 이유).
 */
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
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // 닫으면 눌렀던 「삭제」로 초점을 되돌린다. 그러지 않으면 문서 맨 앞으로 떨어져
    // 키보드로 훑던 사람이 목록을 다시 내려와야 한다.
    const opener = document.activeElement;
    node.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      // 초점을 팝업 안에 가둔다. 뒤에 목록이 그대로 살아 있어, 막지 않으면 탭이
      // 가려진 삭제 버튼으로 빠져나간다.
      const targets = node.querySelectorAll<HTMLElement>("button:not(:disabled)");
      if (targets.length === 0) return;

      const first = targets[0];
      const last = targets[targets.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === node)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    node.addEventListener("keydown", onKeyDown);
    return () => {
      node.removeEventListener("keydown", onKeyDown);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [onClose]);

  async function confirm() {
    setDeleting(true);
    try {
      await deleteRsvp(row.id);
      onDone(row.id);
    } catch (cause) {
      // 실패 메시지에 회신 내용을 싣지 않는다. deleteRsvp 는 권한·이미 지워진 행을
      // 구분해 한국어로 알려 준다.
      onError(cause instanceof Error ? cause.message : "회신을 지우지 못했습니다");
      onClose();
    }
  }

  return createPortal(
    <div className="admin-dialog-overlay">
      <div ref={ref} className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <h2 id={titleId}>이 회신을 지울까요?</h2>

        {/* 누구를 지우는지 다시 적는다. 이름을 앞세우고 나머지는 아래 줄로 내린다 */}
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

        <div className="admin-dialog-actions">
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>
            취소
          </button>
          <button type="button" className="admin-btn admin-btn-danger" onClick={confirm} disabled={deleting}>
            {deleting ? "지우는 중…" : "삭제"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
