// SIS-22 — 관리자 페이지(/admin). AD-01 · RS-04.
//
// **화면은 아직 비어 있다.** 이 페이지는 c안에 없는 화면이라 「c안에 없는 채택
// 기능은 구현 전에 디자인 시안을 확인받는다」(CLAUDE.md)에 따라 시안 확정 뒤
// 채운다. 지금 들어 있는 것은 라우팅·인증·조회·CSV 배선을 실제로 태워 보기 위한
// 자리다.
//
// 채울 때 쓸 재료는 이미 다 있다.
//   src/lib/adminAuth.ts   로그인·로그아웃·권한 확인
//   src/lib/adminRsvp.ts   목록·삭제·집계
//   src/lib/csv.ts         CSV 본문·Blob·파일명
//
// 순서 하나만 지킨다 — **목록을 그리기 전에 isAdmin() 을 먼저 본다.** 권한이 없는
// 계정에는 RLS 가 오류 대신 0건을 주므로, 확인을 건너뛰면 「아직 회신이 없어요」가
// 뜬다(adminRsvp.ts 머리말).
import { useEffect } from "react";

/** index.html 의 부트 화면. 청첩장 쪽은 Loading.tsx 가 걷는다. */
const BOOT_ID = "boot";

export default function Admin() {
  // 이 화면에는 로딩 오버레이가 없어 부트 화면을 걷어 줄 것이 없다. 지우지 않으면
  // 부트가 화면을 덮은 채 그대로 남는다.
  useEffect(() => {
    document.getElementById(BOOT_ID)?.remove();
  }, []);

  return (
    <main className="page">
      <p>관리자 페이지는 준비 중입니다.</p>
    </main>
  );
}
