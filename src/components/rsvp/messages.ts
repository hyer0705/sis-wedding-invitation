// RSVP 화면에 나가는 문구를 한자리에 모아 둔다. 고객 수정 요청이 가장 잦은 것이
// 문구라, 부품마다 흩어 두면 어디를 고쳐야 하는지부터 찾아야 한다.
import { INVITE } from "../../invite";

export const LEAD = "참석 여부를 알려주시면\n준비에 큰 도움이 됩니다.";
export const OPEN_LABEL = "참석 여부 알리기";
export const DONE_MESSAGE = "참석 의사가 전달되었습니다.\n당일 따뜻하게 맞이하겠습니다.";
export const CLOSED_MESSAGE = `참석 회신이 마감되었습니다.\n(${INVITE.rsvp.deadlineText})`;
export const SEND_FAILED = "회신 전송에 실패했어요\n잠시 후 다시 시도해 주세요";

// 검증에 걸린 이유는 각 칸의 인라인 오류가 말한다. 이 한 줄은 「왜 팝업이 안 떴는지」만
// 알린다 — 같은 문장을 요약과 인라인에 두 번 두면 스크린리더가 두 번 읽는다.
export const INVALID_MESSAGE = "입력을 확인해 주세요";

export const CONFIRM_TITLE = "내용 확인";
export const CONFIRM_LEAD = "이대로 전해도 괜찮으실까요?";
export const CONFIRM_SEND = "확인";
export const CONFIRM_BACK = "뒤로";
export const CONFIRM_CLOSE = "닫기";

// 참석에만 붙는다. 미참석은 연락처가 필수가 되면서(SIS-37) 안내할 것이 없어졌고,
// 인원 개념이 없는 자리에서 「대표 한 분」은 말이 되지 않는다.
//
// 「연락드리겠습니다」처럼 목적을 넓히지 않는다 — 개인정보 처리방침이 고지한 수집 목적
// (INVITE.rsvp.privacy)과 어긋나 방침 본문까지 함께 고쳐야 한다.
export const PHONE_HELP = "함께 오시는 분이 있어도 대표 한 분의 연락처만 남겨주세요";
