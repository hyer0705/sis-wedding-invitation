import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  type RsvpPayload,
  type RsvpValues,
} from "../lib/rsvp";
import { scaled } from "../lib/textSize";

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
// 미참석 회신은 인원·식사를 건너뛴다. 연락처는 **참석·미참석 모두 필수**다(SIS-37).
// SIS-35 에서는 미참석만 선택이었다 — 못 간다고 알려주려는 하객을 연락처에서 막으면
// 회신 자체를 포기한다고 보았기 때문인데, 고객이 그 판단을 뒤집었다. DB 도 같은 규칙을
// 본다 — supabase/schema.sql 의 phone 은 not null 이다.
//
// 제출은 **두 단계다**(SIS-36). 「참석 의사 전하기」는 검증만 하고 확인 팝업을 열며,
// 실제 전송은 팝업의 「확인」이 부른다. 회신은 고치는 창구가 따로 없어(전송하면 끝이다)
// 나가기 전에 한 번 되짚어 볼 자리를 둔다.

const LEAD = "참석 여부를 알려주시면\n준비에 큰 도움이 됩니다.";
const OPEN_LABEL = "참석 여부 알리기";
const DONE_MESSAGE = "참석 의사가 전달되었습니다.\n당일 따뜻하게 맞이하겠습니다.";
const CLOSED_MESSAGE = `참석 회신이 마감되었습니다.\n(${INVITE.rsvp.deadlineText})`;
const SEND_FAILED = "회신 전송에 실패했어요\n잠시 후 다시 시도해 주세요";

// 검증에 걸린 이유는 각 칸의 인라인 오류가 말한다. 이 한 줄은 「왜 팝업이 안 떴는지」만
// 알린다 — 같은 문장을 요약과 인라인에 두 번 두면 스크린리더가 두 번 읽는다.
const INVALID_MESSAGE = "입력을 확인해 주세요";

const CONFIRM_TITLE = "내용 확인";
const CONFIRM_LEAD = "이대로 전해도 괜찮으실까요?";
const CONFIRM_SEND = "확인";
const CONFIRM_BACK = "뒤로";
const CONFIRM_CLOSE = "닫기";

// 참석에만 붙는다. 미참석은 연락처가 필수가 되면서(SIS-37) 안내할 것이 없어졌고,
// 인원 개념이 없는 자리에서 「대표 한 분」은 말이 되지 않는다.
//
// 「연락드리겠습니다」처럼 목적을 넓히지 않는다 — 개인정보 처리방침이 고지한 수집 목적
// (INVITE.rsvp.privacy)과 어긋나 방침 본문까지 함께 고쳐야 한다.
const PHONE_HELP = "함께 오시는 분이 있어도 대표 한 분의 연락처만 남겨주세요";

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
        <p
          style={{
            margin: "10px 0 26px",
            fontSize: scaled(14),
            color: "var(--text-body)",
            lineHeight: 1.8,
            whiteSpace: "pre-line",
          }}
        >
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
  const wasShown = useRef(show);
  // 등장 애니메이션이 끝나기를 기다리는 중인지. 상태 전이는 전부 이 effect 안에서만
  // 일어난다 — 렌더 본문에서 ref 를 건드리면 그 렌더가 버려질 때 전이가 함께 사라져,
  // 자동 스크롤이 조용히 멎는다.
  const pendingReveal = useRef(false);

  useEffect(() => {
    if (show && !wasShown.current) pendingReveal.current = true;
    // 접히는 중이면 대기를 거둔다. 이것이 없으면 exit 애니메이션이 끝날 때도
    // 콜백이 불려, 사라지는 칸으로 화면이 끌려간다.
    if (!show) pendingReveal.current = false;
    wasShown.current = show;
  }, [show]);

  const revealDone = () => {
    if (!pendingReveal.current) return;
    pendingReveal.current = false;
    // jsdom 에는 scrollIntoView 가 없다. 테스트에서 터지지 않도록 있을 때만 부른다.
    ref.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  };

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
  // 확인을 기다리는 회신. **화면에 보인 값이 그대로 나가도록 페이로드째 들고 있는다** —
  // 팝업에서 다시 만들면 보여준 것과 보내는 것이 어긋날 자리가 생긴다.
  const [pending, setPending] = useState<RsvpPayload | null>(null);
  // 전송 중 잠금이 폼의 isSubmitting 에서 이리로 옮겨 왔다(SIS-36). handleSubmit 은
  // 이제 팝업을 여는 것으로 끝나 곧바로 반환하므로, isSubmitting 은 전송을 덮지 못한다.
  const [sending, setSending] = useState(false);
  // 팝업의 초점 관리 effect 가 이 함수를 의존한다. 렌더마다 새로 만들면 팝업이 열려
  // 있는 내내 effect 가 다시 돌아, 초점이 팝업과 제출 버튼 사이를 오간다.
  const closeConfirm = useCallback(() => setPending(null), []);
  const {
    handleSubmit,
    register,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RsvpForm, unknown, RsvpValues>({
    resolver: zodResolver(rsvpSchema),
    defaultValues: EMPTY_FORM,
    // 첫 제출까지는 조용히 두고, 그 뒤에는 고치는 대로 오류가 사라지게 한다.
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const values = watch();
  const attending = values.attend === "참석";

  // 앞 항목을 채워야 다음이 나온다. 미참석은 인원·식사를 건너뛰므로 성함 다음이
  // 연락처고, 그 다음이 동의다.
  const showAttend = values.side !== "";
  const showName = showAttend && values.attend !== "";
  const filledName = showName && values.name.trim() !== "";
  const showCount = attending && filledName;
  // 미참석은 인원을 건너뛰므로 성함 다음이 곧 연락처다.
  const showPhone = attending ? showCount && values.count.trim() !== "" : filledName;
  // 연락처가 필수로 돌아오면서(SIS-37) 미참석도 「채워야 다음이 나온다」가 다시
  // 성립한다. 참석은 식사가 한 단계 더 있고, 미참석은 여기서 바로 동의로 간다.
  const filledPhone = showPhone && values.phone.trim() !== "";
  const showMeal = attending && filledPhone;
  const showConsent = attending ? showMeal && values.meal !== "" : filledPhone;

  const pickAttend = (value: string) => {
    setValue("attend", value, { shouldValidate: false });

    // 미참석으로 바꾸면 인원·식사 두 칸이 사라진다. 적어 둔 값을 그대로 두면 화면에
    // 없는 값이 제출되므로 인원은 비우고, 식사 여부는 물을 자리가 없어 '식사안함'으로
    // 채운다 — DB 의 meal 은 not null 이다.
    //
    // 연락처는 비우지 않는다. 미참석에서도 칸이 그대로 남으므로(SIS-37) 지워 버리면
    // 방금 적은 번호가 눈앞에서 사라진다.
    if (value === "미참석") {
      setValue("count", "");
      setValue("meal", "식사안함");
      return;
    }
    // 참석으로 되돌아왔을 때 '식사안함'이 남아 있으면 고르지도 않은 답이 제출된다.
    setValue("meal", "");
  };

  // 검증을 통과해야 팝업이 열린다. 즉 검증 시점이 「전송 직전」에서 「팝업 열기
  // 직전」으로 옮겨 왔다(SIS-36).
  const openConfirm = (data: RsvpValues) => setPending(toRsvpPayload(data));

  // 걸린 칸이 여럿이면 첫 칸으로 초점이 간다 — react-hook-form 의 shouldFocusError
  // 가 기본으로 해 주는 일이라 여기서 따로 옮기지 않는다. 다만 그것은 register 로
  // ref 가 물린 입력에만 닿는다. 선택 버튼 묶음(하객 구분·참석 여부·식사)과 동의는
  // ref 가 없지만, 비어 있으면 뒷 단계가 통째로 접혀 제출 버튼까지 사라지므로
  // (showCount~showConsent 연쇄) 이 자리에 그 상태로 도달하지 않는다.
  const onInvalid = () => showToast(INVALID_MESSAGE);

  const send = async () => {
    if (!pending) return;
    setSending(true);
    try {
      await submitRsvp(pending);
      markSubmitted();
      // 완료 카드로 넘어가며 이 폼이 통째로 사라진다. sending 을 되돌리지 않는 것은
      // 그 사이 확인 버튼이 다시 눌리지 않게 하려는 것이다.
      onDone();
    } catch (error) {
      // 실패를 삼키지 않는다. Apps Script 를 버린 이유가 실패가 조용히 유실되는
      // 것이었다(SIS-33) — 하객이 다시 시도할 수 있어야 회신이 남는다.
      //
      // 원인은 콘솔에 남긴다. 화면에 띄우는 안내는 무엇이 실패해도 같은 한 줄이라,
      // 이 줄이 없으면 고객이 「회신이 안 된다」고 알려와도 컬럼 누락(PGRST204)·
      // 마감/RLS 거부(42501)·네트워크 장애를 구분할 방법이 없다. 실기기에서는
      // 원격 디버깅으로 이 줄을 본다(docs/manual-qa.md).
      //
      // 회신 내용은 이 메시지에 들어 있지 않다 — lib/rsvp.ts 가 걷어낸다.
      console.error(error);
      showToast(SEND_FAILED);
      // 팝업은 닫지 않는다. 닫아 버리면 하객이 여섯 항목을 처음부터 다시 확인해야
      // 한다 — 토스트가 팝업 위(z-index 95)에 뜨고, 그 자리에서 다시 누르면 된다.
      setSending(false);
    }
  };

  return (
    <form className="rsvp-form" onSubmit={handleSubmit(openConfirm, onInvalid)} noValidate>
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
        <TextField label="성함" hint="ex) 정원이" error={errors.name?.message} autoComplete="name" {...register("name")} />
      </Step>

      <Step show={showCount}>
        <TextField
          label="참석 인원 (본인 포함)"
          hint="ex) 2"
          error={errors.count?.message}
          inputMode="numeric"
          {...register("count")}
        />
      </Step>

      <Step show={showPhone}>
        <TextField
          label="연락처"
          // 참석에만 붙는다. 미참석으로 바꾸면 이 줄이 사라진다.
          help={attending ? PHONE_HELP : undefined}
          // 하이픈 없이 숫자만 적어도 된다는 것을 보이는 자리다. 모두 같은 숫자로 적으면
          // 하객이 보고 「번호를 적는 칸」이라고 알아채지 못해, 진짜와 같은 모양을 쓴다.
          // 검토 게이트는 이 값을 예시 목록에 두어 통과시킨다(scripts/review-guard.mjs).
          hint="ex) 01012345678"
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
            안내를 덧붙이지 않는다.

            이 버튼은 이제 전송이 아니라 확인 팝업을 연다(SIS-36). 문구는 그대로
            두었다 — 팝업 버튼을 「확인」으로 줄여 둘이 같아 보이지 않고, 무엇을
            하는 자리인지는 팝업 제목 「내용 확인」이 말한다. */}
        <button type="submit" className="rsvp-submit" style={{ width: "100%" }} disabled={!values.agreed}>
          참석 의사 전하기
        </button>
      </Step>

      <AnimatePresence>
        {pending && <ConfirmDialog payload={pending} sending={sending} onBack={closeConfirm} onConfirm={send} />}
      </AnimatePresence>
    </form>
  );
}

/**
 * 팝업에 싣는 항목. **채운 것만 싣는다.**
 *
 * 미참석의 인원(1)·식사(식사안함)는 DB 의 not null 을 채우려고 toRsvpPayload 가 넣은
 * 값이라 화면에 내보내지 않는다 — 고르지도 않은 답을 확인하게 되고, 「1명이 안 온다」로
 * 읽힐 수도 있다. 남는 넷은 참석·미참석 모두 필수라 빈 줄이 생기지 않는다.
 */
function confirmRows(payload: RsvpPayload): { label: string; value: string }[] {
  const attending = payload.attend === "참석";

  return [
    { label: "하객 구분", value: payload.side },
    { label: "참석 여부", value: payload.attend },
    { label: "성함", value: payload.name },
    ...(attending ? [{ label: "참석 인원", value: `${payload.count}명` }] : []),
    // 저장되는 모양 그대로 보인다(하이픈 없는 숫자). 국가번호를 붙여 적으면
    // normalizePhone 이 국내 표기로 되돌리는데, 그 결과를 확인할 자리이기도 하다.
    { label: "연락처", value: payload.phone },
    ...(attending ? [{ label: "식사 여부", value: payload.meal }] : []),
  ];
}

/**
 * 제출 확인 팝업 (SIS-36). 회신은 전송하면 고칠 창구가 없어, 나가기 전에 한 번 되짚는다.
 *
 * body 에 직접 그린다. 토스트와 같은 이유다 — 섹션 안에 두면 스크롤 리빌이 조상에 건
 * transform 이 position:fixed 의 기준이 되어, 팝업이 화면이 아니라 카드 어딘가에 뜬다.
 *
 * 「뒤로」·X·Esc 어느 쪽으로 닫아도 **폼은 채운 그대로 남는다** — 이 컴포넌트는 값을
 * 들고만 있고 폼 상태를 건드리지 않는다.
 */
function ConfirmDialog({
  payload,
  sending,
  onBack,
  onConfirm,
}: {
  payload: RsvpPayload;
  sending: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const leadId = useId();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // 팝업 밖으로 돌아갈 자리를 기억해 둔다. 닫으면 눌렀던 제출 버튼으로 되돌린다 —
    // 그러지 않으면 초점이 문서 맨 앞으로 떨어져, 키보드로 훑던 사람이 폼을 다시
    // 찾아 내려와야 한다.
    const opener = document.activeElement;

    // 상자 자체에 초점을 준다. 「확인」에 바로 주면 엔터 한 번에 전송되고, 스크린리더도
    // 제목보다 버튼 이름을 먼저 읽는다.
    node.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onBack();
        return;
      }
      if (event.key !== "Tab") return;

      // 초점을 팝업 안에 가둔다. 뒤에 폼이 그대로 살아 있어, 막지 않으면 탭이 가려진
      // 입력 칸으로 빠져나가 어디에 있는지 알 수 없게 된다.
      // 이 팝업에 초점을 받는 것은 버튼뿐이고, 전송 중에는 「확인」이 빠진다.
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
  }, [onBack]);

  return createPortal(
    <m.div
      className="rsvp-confirm-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* 배경을 눌러도 닫지 않는다. 되돌아가는 길은 「뒤로」와 X 둘로 정해져 있고
          (2026-08-18 확정), 화면을 꽉 채운 팝업에서는 배경을 누를 자리가 손가락이
          미끄러진 자리와 구분되지 않는다. */}
      <div
        ref={ref}
        className="rsvp-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={leadId}
        tabIndex={-1}
      >
        <button type="button" className="rsvp-confirm-close" onClick={onBack} aria-label={CONFIRM_CLOSE}>
          ✕
        </button>

        <h3 id={titleId} className="rsvp-confirm-title">
          {CONFIRM_TITLE}
        </h3>
        <p id={leadId} className="rsvp-confirm-lead">
          {CONFIRM_LEAD}
        </p>

        <dl className="rsvp-confirm-summary">
          {confirmRows(payload).map((row) => (
            <div key={row.label} style={{ display: "contents" }}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>

        <div className="rsvp-confirm-actions">
          {/* 보내는 중에도 닫을 수 있게 둔다. 「확인」만 잠근다 — 요청에 시간 제한이
              없어, 셋 다 잠그면 응답이 늦는 동안 팝업에 갇힌다. 닫고 나가도 요청은
              그대로 끝나 성공이면 완료 카드가, 실패면 토스트가 뜬다. */}
          <button type="button" className="rsvp-confirm-btn rsvp-confirm-back" onClick={onBack}>
            {CONFIRM_BACK}
          </button>
          <button type="button" className="rsvp-confirm-btn rsvp-confirm-send" onClick={onConfirm} disabled={sending}>
            {sending ? "전하는 중…" : CONFIRM_SEND}
          </button>
        </div>
      </div>
    </m.div>,
    document.body,
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
  help,
  hint,
  error,
  inputMode,
  autoComplete,
  ref,
  ...field
}: {
  label: string;
  /**
   * 라벨 아래에 남는 안내 문구 (SIS-36).
   *
   * hint 를 넓혀 쓰지 않은 이유가 둘이다. placeholder 는 글자를 적는 순간 사라져
   * 정작 적는 동안에는 보이지 않고, 그 문자열은 review-guard.mjs 의 예시 번호
   * 목록에 등록되어 검토 게이트를 통과한다 — 바꾸면 가드까지 함께 봐야 한다.
   */
  help?: string;
  /** 형식 예시. placeholder 는 이것만 담는다. */
  hint?: string;
  error?: string;
  inputMode?: "numeric" | "tel";
  autoComplete?: string;
} & React.ComponentPropsWithRef<"input">) {
  const inputId = useId();
  const helpId = useId();
  const errorId = useId();

  // 안내와 오류가 함께 있으면 둘 다 읽힌다. 안내를 먼저 두어 「무엇을 적는 칸인지」가
  // 「무엇이 틀렸는지」보다 앞에 오게 한다.
  const describedBy = [help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div>
      {/* 라벨을 칸 위에 그대로 보인다. c안은 placeholder 를 라벨로 썼는데, 그러면
          글자를 적는 순간 무엇을 적는 칸이었는지가 화면에서 사라진다 — 나중에
          확인하려 할 때 알 길이 없고, 폼에 익숙하지 않을수록 크게 걸린다. */}
      <label className="rsvp-label" htmlFor={inputId}>
        {label}
      </label>
      {help && (
        <span id={helpId} className="rsvp-help">
          {help}
        </span>
      )}
      <input
        {...field}
        ref={ref}
        id={inputId}
        className={`rsvp-input${error ? " rsvp-invalid" : ""}`}
        placeholder={hint}
        inputMode={inputMode}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
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
