import { useId, useState } from "react";
import GuestbookDialog from "./GuestbookDialog";
import { useToast } from "./Toast";
import { deleteGuestbookEntry, type GuestbookEntry, passwordError } from "../lib/guestbook";

const TITLE = "메시지 지우기";
const LEAD = "한 번 지우면 되돌릴 수 없습니다";
const CLOSE_LABEL = "지우기 창 닫기";
const WRONG_PASSWORD = "비밀번호가 맞지 않습니다";
const DONE = "축하 메시지를 지웠습니다";
const FAILED = "지우지 못했어요\n잠시 뒤 다시 시도해 주세요";

export default function GuestbookDeleteDialog({
  entry,
  onClose,
  onDeleted,
}: {
  entry: GuestbookEntry;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const showToast = useToast();
  const inputId = useId();
  const errorId = useId();

  const submit = async () => {
    const tooShort = passwordError(password);
    if (tooShort) {
      setError(tooShort);
      return;
    }

    setSending(true);
    setError(null);

    try {
      const removed = await deleteGuestbookEntry(entry.id, password);
      if (removed) {
        showToast(DONE);
        onDeleted(entry.id);
        return;
      }
      setError(WRONG_PASSWORD);
    } catch {
      showToast(FAILED);
    }

    setSending(false);
  };

  return (
    <GuestbookDialog title={TITLE} lead={LEAD} closeLabel={CLOSE_LABEL} onClose={onClose}>
      <div style={{ margin: "0 0 18px", padding: 16, borderRadius: 16, background: "var(--surface-3)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{entry.name}</div>
        <p className="gb-message" style={{ margin: "7px 0 0", fontSize: 13.5, lineHeight: 1.8, textAlign: "left" }}>
          {entry.message}
        </p>
      </div>

      <label className="gb-label" htmlFor={inputId}>
        비밀번호
      </label>
      <input
        id={inputId}
        className={error ? "gb-input gb-invalid" : "gb-input"}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          setError(null);
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <p id={errorId} className="gb-error" role="alert">
          {error}
        </p>
      )}

      <div className="gb-dialog-actions" style={{ marginTop: 22 }}>
        <button type="button" className="gb-dialog-btn gb-dialog-cancel" onClick={onClose}>
          취소
        </button>
        <button type="button" className="gb-dialog-btn gb-dialog-danger" onClick={submit} disabled={sending}>
          {sending ? "지우는 중…" : "지우기"}
        </button>
      </div>
    </GuestbookDialog>
  );
}
