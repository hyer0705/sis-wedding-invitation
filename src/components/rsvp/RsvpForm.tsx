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

export default function RsvpForm({ onDone }: { onDone: () => void }) {
  const showToast = useToast();
  const [pending, setPending] = useState<RsvpPayload | null>(null);
  const [sending, setSending] = useState(false);
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
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const values = watch();
  const attending = values.attend === "참석";

  const showAttend = values.side !== "";
  const showName = showAttend && values.attend !== "";
  const filledName = showName && values.name.trim() !== "";
  const showCount = attending && filledName;
  const showPhone = attending ? showCount && values.count.trim() !== "" : filledName;
  const filledPhone = showPhone && values.phone.trim() !== "";
  const showMeal = attending && filledPhone;
  const showConsent = attending ? showMeal && values.meal !== "" : filledPhone;

  const pickAttend = (value: string) => {
    setValue("attend", value, { shouldValidate: false });

    if (value === "미참석") {
      setValue("count", "");
      setValue("meal", "식사안함");
      return;
    }
    setValue("meal", "");
  };

  const openConfirm = (data: RsvpValues) => setPending(toRsvpPayload(data));

  const onInvalid = () => showToast(INVALID_MESSAGE);

  const send = async () => {
    if (!pending) return;
    setSending(true);
    try {
      await submitRsvp(pending);
      markSubmitted();
      onDone();
    } catch (error) {
      console.error(error);
      showToast(SEND_FAILED);
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
          help={attending ? PHONE_HELP : undefined}
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
