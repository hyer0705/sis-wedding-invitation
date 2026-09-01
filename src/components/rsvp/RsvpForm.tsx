import { useCallback, useState } from "react";
import { AnimatePresence } from "motion/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import PickGroup from "../form/PickGroup";
import TextField from "../form/TextField";
import { useToast } from "../Toast";
import Step from "./Step";
import PrivacyNotice from "./PrivacyNotice";
import RsvpConfirmDialog from "./RsvpConfirmDialog";
import { INVALID_MESSAGE, PHONE_HELP, SEND_FAILED } from "./messages";
import {
  ATTEND_OPTIONS,
  EMPTY_FORM,
  MEAL_OPTIONS,
  SIDE_OPTIONS,
  markSubmitted,
  rsvpSchema,
  submitRsvp,
  toRsvpPayload,
  type RsvpForm as RsvpFormInput,
  type RsvpPayload,
  type RsvpValues,
} from "../../lib/rsvp";

// 폼을 버튼 뒤로 숨기고, 항목을 한 번에 하나씩 내보낸다(2026-08-18 사용자 결정).
// 이것이 이 컴포넌트의 뼈대다. c안은 여섯 칸을 한 번에 펼쳐 두는데, 항목이 늘면서
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
export default function RsvpForm({ onDone }: { onDone: () => void }) {
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
  } = useForm<RsvpFormInput, unknown, RsvpValues>({
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
        {pending && <RsvpConfirmDialog payload={pending} sending={sending} onBack={closeConfirm} onConfirm={send} />}
      </AnimatePresence>
    </form>
  );
}
