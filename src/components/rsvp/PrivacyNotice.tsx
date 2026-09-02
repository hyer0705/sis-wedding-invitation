import { useId, useState } from "react";
import FieldError from "../form/FieldError";
import { INVITE } from "../../invite";

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

      {open && (
        <div className="privacy-policy-wrap">
          <PrivacyPolicy id={panelId} />
        </div>
      )}
    </div>
  );
}

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
