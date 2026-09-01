import { useId, useState } from "react";
import FieldError from "../form/FieldError";
import { INVITE } from "../../invite";

/**
 * RS-03 개인정보 수집·이용 안내와 동의.
 *
 * 문구는 전부 INVITE.rsvp.privacy 에서 온다 — 법적 요구사항이라 화면에서 문장을
 * 만들거나 줄이지 않는다.
 */
export default function PrivacyNotice({
  checked,
  error,
  onChange,
}: {
  checked: boolean;
  error?: string;
  onChange: (checked: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const errorId = useId();
  const { title, summary, consentLabel, detailLabel } = INVITE.rsvp.privacy;

  return (
    <div className="privacy">
      <h3 className="privacy-title">{title}</h3>

      <dl className="privacy-summary">
        {summary.map((item) => (
          <div key={item.label} style={{ display: "contents" }}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>

      <label className="privacy-consent">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-describedby={error ? errorId : undefined}
        />
        <span>{consentLabel}</span>
      </label>
      {error && <FieldError id={errorId} message={error} />}

      {/* 접힘·펼침을 화살표로 알린다. 계좌 아코디언과 같은 기호를 써서, 이 청첩장
          안에서 「눌러 펼치는 것」의 생김새를 하나로 맞춘다. */}
      <button
        type="button"
        className="privacy-toggle"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
      >
        <span>{open ? "개인정보 처리방침 접기" : detailLabel}</span>
        <span className="privacy-toggle-arrow" aria-hidden="true" data-open={open}>
          ⌄
        </span>
      </button>

      {/* 접었을 때 DOM 에서 뺀다. 계좌 아코디언과 같은 이유다 — 숨겨진 채 남아 있으면
          스크린리더가 펴지도 않은 전문을 읽어 내려간다.
          감싸는 div 는 아래쪽 페이드를 얹을 자리다 — 잘린 곳이 그냥 끊긴 것처럼 보이면
          아래에 더 있다는 것을 알 수 없다. */}
      {open && (
        <div className="privacy-policy-wrap">
          <PrivacyPolicy id={panelId} />
        </div>
      )}
    </div>
  );
}

/**
 * 처리방침 전문. 9개 항목이라 그대로 펼치면 카드가 화면 몇 배로 늘어난다. 자체 높이를
 * 두고 그 안에서만 스크롤하게 해, 펼쳐도 폼의 위치가 흔들리지 않게 한다.
 *
 * 스크롤 영역에는 tabIndex 를 준다 — 마우스 없이 훑는 사용자가 키보드만으로 안쪽을
 * 내릴 수 있어야 하고, 브라우저는 스크롤 컨테이너에 자동으로 초점을 주지 않는다.
 */
function PrivacyPolicy({ id }: { id: string }) {
  const { policy, officer } = INVITE.rsvp.privacy;

  return (
    <div id={id} className="privacy-policy" tabIndex={0} role="region" aria-label={policy.title}>
      <h4>{policy.title}</h4>
      <p>{policy.intro}</p>

      {policy.sections.map((section) => (
        <section key={section.heading}>
          <h4>{section.heading}</h4>
          {section.blocks.map((block, index) =>
            block.kind === "p" ? (
              <p key={index}>{block.text}</p>
            ) : (
              <div key={index}>
                {/* dl 바깥이라 dt 를 쓸 수 없다 — 소제목은 문단으로 둔다 */}
                {"label" in block && <p className="privacy-label">{block.label}</p>}
                <ul>
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ),
          )}
        </section>
      ))}

      {/* 담당자는 .env 로만 들어온다(mock 없음). 값이 비면 이 문단째 사라지고,
          그 상태는 `npm run verify` 가 배포 전에 잡는다. */}
      {officer.name && officer.email && (
        <section>
          <h4>{officer.heading}</h4>
          <p>담당자: {officer.name}</p>
          <p>
            이메일: <a href={`mailto:${officer.email}`}>{officer.email}</a>
          </p>
        </section>
      )}
    </div>
  );
}
