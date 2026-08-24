import { useId, useState } from "react";
import GuestbookDialog from "./GuestbookDialog";
import { useToast } from "./Toast";
import {
  createGuestbookEntry,
  EMPTY_GUESTBOOK_FORM,
  type GuestbookErrors,
  type GuestbookField,
  type GuestbookForm,
  MESSAGE_MAX,
  NAME_MAX,
  validateGuestbookForm,
} from "../lib/guestbook";

const TITLE = "축하 메시지 남기기";
const LEAD = "남겨 주신 글은 청첩장에 그대로 보여집니다";
const CLOSE_LABEL = "작성 창 닫기";
const DONE = "축하 메시지를 남겼습니다";
const FAILED = "남기지 못했어요\n잠시 뒤 다시 시도해 주세요";
const PASSWORD_HELP = "글을 지우실 때 필요합니다 숫자 4자 이상으로 정해 주세요";

export default function GuestbookWriteDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<GuestbookForm>(EMPTY_GUESTBOOK_FORM);
  const [errors, setErrors] = useState<GuestbookErrors>({});
  const [sending, setSending] = useState(false);
  const showToast = useToast();

  const nameId = useId();
  const messageId = useId();
  const passwordId = useId();
  const helpId = useId();
  const errorIds = { name: `${nameId}-error`, message: `${messageId}-error`, password: `${passwordId}-error` };

  const update = (field: GuestbookField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async () => {
    const result = validateGuestbookForm(form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    setSending(true);

    try {
      await createGuestbookEntry(result.values);
      showToast(DONE);
      onCreated();
      return;
    } catch {
      showToast(FAILED);
    }

    setSending(false);
  };

  return (
    <GuestbookDialog title={TITLE} lead={LEAD} closeLabel={CLOSE_LABEL} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, textAlign: "left" }}>
        <div>
          <label className="gb-label" htmlFor={nameId}>
            이름
          </label>
          <input
            id={nameId}
            className={errors.name ? "gb-input gb-invalid" : "gb-input"}
            value={form.name}
            maxLength={NAME_MAX}
            autoComplete="name"
            onChange={(event) => update("name", event.target.value)}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? errorIds.name : undefined}
          />
          {errors.name && (
            <p id={errorIds.name} className="gb-error" role="alert">
              {errors.name}
            </p>
          )}
        </div>

        <div>
          <label className="gb-label" htmlFor={messageId}>
            축하 메시지
          </label>
          <textarea
            id={messageId}
            className={errors.message ? "gb-input gb-textarea gb-invalid" : "gb-input gb-textarea"}
            rows={5}
            value={form.message}
            maxLength={MESSAGE_MAX}
            onChange={(event) => update("message", event.target.value)}
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={errors.message ? errorIds.message : undefined}
          />
          <p className="gb-counter">
            {form.message.length} / {MESSAGE_MAX}
          </p>
          {errors.message && (
            <p id={errorIds.message} className="gb-error" role="alert">
              {errors.message}
            </p>
          )}
        </div>

        <div>
          <label className="gb-label" htmlFor={passwordId} style={{ marginBottom: 4 }}>
            비밀번호
          </label>
          <span id={helpId} className="gb-help">
            {PASSWORD_HELP}
          </span>
          <input
            id={passwordId}
            className={errors.password ? "gb-input gb-invalid" : "gb-input"}
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            value={form.password}
            onChange={(event) => update("password", event.target.value)}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? `${helpId} ${errorIds.password}` : helpId}
          />
          {errors.password && (
            <p id={errorIds.password} className="gb-error" role="alert">
              {errors.password}
            </p>
          )}
        </div>
      </div>

      <div className="gb-dialog-actions" style={{ marginTop: 22 }}>
        <button type="button" className="gb-dialog-btn gb-dialog-cancel" onClick={onClose}>
          취소
        </button>
        <button type="button" className="gb-dialog-btn gb-dialog-send" onClick={submit} disabled={sending}>
          {sending ? "남기는 중…" : "남기기"}
        </button>
      </div>
    </GuestbookDialog>
  );
}
