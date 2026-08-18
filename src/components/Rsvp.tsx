import { useId, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Reveal from "./Reveal";
import { useToast } from "./Toast";
import { INVITE } from "../invite";
import {
  ATTEND_OPTIONS,
  EMPTY_FORM,
  MEAL_OPTIONS,
  SIDE_OPTIONS,
  alreadySubmitted,
  isRsvpClosed,
  markSubmitted,
  rsvpSchema,
  submitRsvp,
  toRsvpPayload,
  type RsvpForm,
  type RsvpValues,
} from "../lib/rsvp";

// RS-01 참석 여부 회신 · RS-03 개인정보 수집 동의.
//
// c안 §8 을 옮기면서 달라진 것들:
//   1. 「전하고 싶은 말」을 뺐다 — 방명록(SIS-21)이 같은 역할을 한다(2026-08-18 확정)
//   2. 식사 여부 3택과 연락처를 더했다 — 둘 다 c안에 없던 항목이다
//   3. 폼을 버튼 뒤로 숨기고, 항목을 한 번에 하나씩 내보낸다(2026-08-18 사용자 결정)
//
// 3번이 이 컴포넌트의 뼈대다. c안은 여섯 칸을 한 번에 펼쳐 두는데, 항목이 늘면서
// 카드가 화면 두 배 길이가 됐다. 처음에는 버튼 하나만 두고, 앞 항목을 채워야 다음
// 항목이 나타나게 해 한 번에 한 가지만 묻는다.
//
// 미참석 회신은 인원·연락처·식사를 건너뛴다. 못 간다고 알려주려는 하객을 연락처에서
// 막으면 회신 자체를 포기하고, 식수 파악이라는 본래 목적을 놓친다. DB 도 같은 규칙을
// 본다 — supabase/schema.sql 의 rsvp_phone_required_for_attendees.

const LEAD = "참석 여부를 알려주시면\n준비에 큰 도움이 됩니다.";
const OPEN_LABEL = "참석 여부 알리기";
const DONE_MESSAGE = "참석 의사가 전달되었습니다.\n당일 따뜻하게 맞이하겠습니다.";
const CLOSED_MESSAGE = `참석 회신이 마감되었습니다.\n(${INVITE.rsvp.deadlineText})`;
const SEND_FAILED = "회신 전송에 실패했어요\n잠시 후 다시 시도해 주세요";

export default function Rsvp() {
  // 마감 판정은 그릴 때 한 번만 한다. 하객이 페이지를 열어 둔 채 자정을 넘기는 일은
  // 드물고, 그 한 건을 잡자고 타이머를 돌리면 화면이 폼에서 안내로 갑자기 바뀐다.
  const closed = isRsvpClosed();
  const [submitted, setSubmitted] = useState(alreadySubmitted);
  const [open, setOpen] = useState(false);

  return (
    <Reveal>
      <div className="card">
        <div className="script-title">R.S.V.P</div>
        <p style={{ margin: "10px 0 26px", fontSize: 14, color: "var(--text-sub)", lineHeight: 1.8, whiteSpace: "pre-line" }}>
          {LEAD}
        </p>

        {closed ? (
          <Notice title="Thank you" message={CLOSED_MESSAGE} />
        ) : submitted ? (
          <Notice title="Thank you" message={DONE_MESSAGE} />
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            {open ? (
              <m.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                <RsvpFormFields onDone={() => setSubmitted(true)} />
              </m.div>
            ) : (
              // 폼을 여는 버튼 하나만 둔다. 카드가 짧아 다음 섹션이 바로 이어지고,
              // 회신할 사람만 폼을 펼치게 된다.
              <m.div key="opener" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <button type="button" className="rsvp-submit" style={{ width: "100%" }} onClick={() => setOpen(true)}>
                  {OPEN_LABEL}
                </button>
              </m.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </Reveal>
  );
}

/** 완료·마감 안내 카드. c안 §8 의 Thank you 박스를 그대로 쓴다. */
function Notice({ title, message }: { title: string; message: string }) {
  return (
    <div className="rsvp-done">
      <div className="script-title" style={{ fontSize: 30 }}>
        {title}
      </div>
      <p>{message}</p>
    </div>
  );
}

/**
 * 한 단계를 감싸 높이 전환으로 내보낸다.
 *
 * 새로 나타나면 그 자리로 화면을 옮긴다. 다음 칸은 늘 아래에 생기는데, 화면 밖이면
 * 하객은 아무 일도 일어나지 않았다고 본다 — 특히 폼에 익숙하지 않은 분일수록
 * "다 적었는데 버튼이 없다"에서 회신을 포기한다. block:"nearest" 라 이미 보이는
 * 자리면 화면을 흔들지 않는다.
 *
 * 높이 전환이 끝난 뒤에 옮겨야 최종 위치로 간다. 그래서 애니메이션 완료를 기다린다.
 */
function Step({ show, children }: { show: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // 처음부터 보이던 단계는 옮기지 않는다. 폼을 여는 순간 첫 항목으로 튀지 않게 한다.
  const appeared = useRef(show);

  const revealDone = () => {
    if (appeared.current) return;
    appeared.current = true;
    // jsdom 에는 scrollIntoView 가 없다. 테스트에서 터지지 않도록 있을 때만 부른다.
    ref.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  };

  if (!show && appeared.current) appeared.current = false;

  return (
    <AnimatePresence initial={false}>
      {show && (
        <m.div
          ref={ref}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          onAnimationComplete={revealDone}
          style={{ overflow: "hidden" }}
        >
          {/* 접힐 때 아래 여백까지 함께 걷히도록 안쪽에 준다 */}
          <div style={{ paddingTop: 12 }}>{children}</div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

function RsvpFormFields({ onDone }: { onDone: () => void }) {
  const showToast = useToast();
  const {
    handleSubmit,
    register,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RsvpForm, unknown, RsvpValues>({
    resolver: zodResolver(rsvpSchema),
    defaultValues: EMPTY_FORM,
    // 첫 제출까지는 조용히 두고, 그 뒤에는 고치는 대로 오류가 사라지게 한다.
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const values = watch();
  const attending = values.attend === "참석";

  // 앞 항목을 채워야 다음이 나온다. 미참석은 인원·연락처·식사를 건너뛰므로 성함
  // 다음이 바로 동의다.
  const showAttend = values.side !== "";
  const showName = showAttend && values.attend !== "";
  const filledName = showName && values.name.trim() !== "";
  const showCount = attending && filledName;
  const showPhone = showCount && values.count.trim() !== "";
  const showMeal = showPhone && values.phone.trim() !== "";
  const showConsent = attending ? showMeal && values.meal !== "" : filledName;

  const pickAttend = (value: string) => {
    setValue("attend", value, { shouldValidate: false });

    // 미참석으로 바꾸면 세 칸이 사라진다. 적어 둔 값을 그대로 두면 화면에 없는 값이
    // 제출되므로 함께 비운다. 식사 여부는 물을 자리가 없어 '식사안함'으로 채운다 —
    // DB 의 meal 은 not null 이다.
    if (value === "미참석") {
      setValue("count", "");
      setValue("phone", "");
      setValue("meal", "식사안함");
      return;
    }
    // 참석으로 되돌아왔을 때 '식사안함'이 남아 있으면 고르지도 않은 답이 제출된다.
    setValue("meal", "");
  };

  const onSubmit = async (data: RsvpValues) => {
    try {
      await submitRsvp(toRsvpPayload(data));
      markSubmitted();
      onDone();
    } catch {
      // 실패를 삼키지 않는다. Apps Script 를 버린 이유가 실패가 조용히 유실되는
      // 것이었다(SIS-33) — 하객이 다시 시도할 수 있어야 회신이 남는다.
      showToast(SEND_FAILED);
    }
  };

  return (
    <form className="rsvp-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <PickGroup
        legend="하객 구분"
        options={SIDE_OPTIONS}
        value={values.side}
        error={errors.side?.message}
        onPick={(value) => setValue("side", value, { shouldValidate: false })}
      />

      <Step show={showAttend}>
        <PickGroup
          legend="참석 여부"
          options={ATTEND_OPTIONS}
          value={values.attend}
          error={errors.attend?.message}
          onPick={pickAttend}
        />
      </Step>

      <Step show={showName}>
        <TextField label="성함" error={errors.name?.message} autoComplete="name" {...register("name")} />
      </Step>

      <Step show={showCount}>
        <TextField label="참석 인원 (본인 포함)" error={errors.count?.message} inputMode="numeric" {...register("count")} />
      </Step>

      <Step show={showPhone}>
        <TextField
          label="연락처"
          // 하이픈 없이 숫자만 적어도 된다는 것을 보이는 자리다. 진짜처럼 보이는 번호로
          // 적으면 검토 게이트가 개인정보로 보고 커밋을 막는다 — 예시는 모든 자리를 같은
          // 숫자로 적는 것이 이 리포의 관례다(.env.example 의 계좌 예시와 같다).
          hint="ex) 00000000000"
          error={errors.phone?.message}
          inputMode="tel"
          autoComplete="tel"
          {...register("phone")}
        />
      </Step>

      <Step show={showMeal}>
        <PickGroup
          legend="식사 여부"
          options={MEAL_OPTIONS}
          value={values.meal}
          error={errors.meal?.message}
          onPick={(value) => setValue("meal", value, { shouldValidate: false })}
        />
      </Step>

      <Step show={showConsent}>
        <PrivacyNotice
          checked={values.agreed}
          error={errors.agreed?.message}
          onChange={(agreed) => setValue("agreed", agreed, { shouldValidate: false })}
        />

        {/* 동의 전에는 누를 수 없다(RS-03). 잠긴 이유가 바로 위에 보이므로 별도
            안내를 덧붙이지 않는다. */}
        <button type="submit" className="rsvp-submit" style={{ width: "100%" }} disabled={!values.agreed || isSubmitting}>
          {isSubmitting ? "전하는 중…" : "참석 의사 전하기"}
        </button>
      </Step>
    </form>
  );
}

/**
 * 선택 버튼 묶음. 라디오가 아니라 토글 버튼(aria-pressed)으로 둔 것은 c안의 모양을
 * 지키기 위해서다. fieldset·legend 로 묶어야 스크린리더가 "무엇을 고르는 버튼인지"를
 * 읽는다 — 버튼 이름만으로는 「신랑측 하객」이 어느 질문의 답인지 알 수 없다.
 */
function PickGroup({
  legend,
  options,
  value,
  error,
  onPick,
}: {
  legend: string;
  options: readonly { value: string; label: string }[];
  value: string;
  error?: string;
  onPick: (value: string) => void;
}) {
  const errorId = useId();

  return (
    <div>
      <fieldset className="pick-group" aria-describedby={error ? errorId : undefined}>
        <legend className="sr-only">{legend}</legend>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="pick-btn"
            aria-pressed={value === option.value}
            onClick={() => onPick(option.value)}
          >
            {option.label}
          </button>
        ))}
      </fieldset>
      {error && <FieldError id={errorId} message={error} />}
    </div>
  );
}

/**
 * register 가 돌려주는 props 를 그대로 받도록 ref 를 넘긴다. RHF 는 이 ref 로 입력을
 * 잡아 오류가 난 첫 칸에 포커스를 준다.
 */
function TextField({
  label,
  hint,
  error,
  inputMode,
  autoComplete,
  ref,
  ...field
}: {
  label: string;
  /** 형식 예시. placeholder 는 이것만 담는다. */
  hint?: string;
  error?: string;
  inputMode?: "numeric" | "tel";
  autoComplete?: string;
} & React.ComponentPropsWithRef<"input">) {
  const inputId = useId();
  const errorId = useId();

  return (
    <div>
      {/* 라벨을 칸 위에 그대로 보인다. c안은 placeholder 를 라벨로 썼는데, 그러면
          글자를 적는 순간 무엇을 적는 칸이었는지가 화면에서 사라진다 — 나중에
          확인하려 할 때 알 길이 없고, 폼에 익숙하지 않을수록 크게 걸린다. */}
      <label className="rsvp-label" htmlFor={inputId}>
        {label}
      </label>
      <input
        {...field}
        ref={ref}
        id={inputId}
        className={`rsvp-input${error ? " rsvp-invalid" : ""}`}
        placeholder={hint}
        inputMode={inputMode}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && <FieldError id={errorId} message={error} />}
    </div>
  );
}

/** 오류 한 줄. role="alert" 로 새로 뜬 오류가 스크린리더에 바로 읽히게 한다. */
function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="rsvp-error" role="alert">
      {message}
    </p>
  );
}

/**
 * RS-03 개인정보 수집·이용 안내와 동의.
 *
 * 문구는 전부 INVITE.rsvp.privacy 에서 온다 — 법적 요구사항이라 화면에서 문장을
 * 만들거나 줄이지 않는다.
 */
function PrivacyNotice({ checked, error, onChange }: { checked: boolean; error?: string; onChange: (checked: boolean) => void }) {
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
