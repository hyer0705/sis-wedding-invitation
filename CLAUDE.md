# 모바일 청첩장 프로젝트 (sis-wedding-invitation)

모바일 청첩장 제작 프로젝트. 고객(신랑·신부)의 수정 요청에 빠르고 정확하게 대응하는 것이 최우선 목표.

## 작업 워크플로
브랜치 전략·마일스톤·이슈 진행 규칙은 **`docs/WORKFLOW.md`** 를 따른다.
"M1 / M2 / M3 / M4 진행해줘" 요청을 받으면 그 문서의 「마일스톤 진행 절차」를 그대로 실행한다.
이슈는 Linear 팀 `Sis-wedding-project`(식별자 `SIS`)에서 관리하며, 로컬에 별도 작업 목록을 만들지 않는다.
**이슈는 하나씩 처리한다** — 병합까지 끝낸 뒤 다음으로 넘어간다.

- 검토·보안 기준은 **`docs/REVIEW.md`**
- 명세서 기능 ID ↔ 이슈 매핑과 **미채택 기능 목록**은 **`docs/FEATURE-MAP.md`**

## 고객 요구사항의 단일 기준

기능 채택 여부와 고객 정보는 **Google Sheets 「기능 요구사항 명세서」가 유일한 기준**이다. 코드나 c안 시안이 명세서와 다르면 명세서를 따른다.

- **미채택(X) 기능은 만들지 않는다.** 시트에 관련 정보가 채워져 있어도 마찬가지다 (예: 연락처 `CT-01·02·03`)
- **c안에 없는 채택 기능은 구현 전에 디자인 시안을 확인받는다.** 기존 토큰 안에서만 해결한다

## 기준 디자인
- **확정 시안: c안** (`drafts/c.dc.html`, Figma용: `drafts/c-design.figma.svg`)
- `drafts/a.dc.html`, `drafts/b.dc.html`은 탈락 시안 — 참고만 하고 절대 수정하지 않는다
- `drafts/` 전체는 시안 보관용 — 수정하지 않는다 (support.js 포함)
- 디자인 변경은 반드시 c안의 토큰(아래) 안에서. 임의로 새 색상·폰트를 추가하지 않는다

## 기술 스택 (확정)
- **Vite + React 19 + TypeScript**, 정적 빌드. 스타일은 `src/styles/tokens.css`의 CSS 변수 + 일반 CSS (Tailwind·CSS-in-JS 금지)
- 애니메이션: **Motion for React만 허용** (`LazyMotion` + `m` 컴포넌트, `MotionConfig reducedMotion="user"` 유지). 다른 애니메이션 라이브러리 추가 금지
- 지도: Kakao Maps JS SDK + 외부 링크 3종(네이버지도·카카오맵·티맵). 카카오내비가 아닌 이유는 `src/lib/mapLinks.ts` 머리말
- 공유: `index.html` OG 태그는 **`vite.config.ts`의 `inviteMeta` 플러그인이 `INVITE`에서 빌드 시점에 주입**(직접 적지 않는다 — 값이 어긋난 채 배포된 적 있음). 썸네일은 R2의 `og-image.jpg`(JPEG — 외부 스크래퍼는 WebP 지원이 제각각) + Kakao JS SDK(`src/lib/share.ts`) + `navigator.share` 폴백
- RSVP: Google Apps Script 웹앱 → Google Sheets (`src/lib/rsvp.ts`). DB 없음. `no-cors` POST + localStorage 중복 방지
- 이미지: 원본은 `photos-original/`(git 제외) → `npm run optimize`(sharp)로 WebP 2벌(480w/960w) → `public/images/`(git 제외) → `npm run upload:images`로 **Cloudflare R2**에 업로드. 사진은 리포에 커밋하지 않는다. 로딩 URL은 `VITE_IMAGE_BASE_URL` + `src/lib/imageUrl.ts`가 만들며, 값이 비면 로컬 `/images` 폴백
- 호스팅: Vercel — `main` 푸시 시 배포, PR 프리뷰 URL은 고객 검수용
- 비밀값(Kakao JS 키, Apps Script URL)은 `.env` (템플릿: `.env.example`)

### 명령어
| 명령 | 역할 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm test` | Vitest watch |
| `npm run test:unit` | Vitest 1회 실행 (CI용) |
| `npm run test:e2e` | Playwright — 모바일 3종 뷰포트 + 접근성 |
| `npm run check` | prettier + eslint + 유닛테스트 + tsc + build (커밋 전 게이트) |
| `npm run review` | 스테이징 변경의 시크릿·개인정보·금지 파일 검사 (pre-commit 훅) |
| `npm run review:branch` | `develop...HEAD` + 커밋 메시지 검사 (**PR 전 게이트**, CI에서도 실행) |
| `npm run optimize` | 원본 사진 → WebP 변환 |
| `npm run upload:images` | `public/images/` → Cloudflare R2 업로드. 목록만 볼 때는 `npm run upload:images -- --dry-run` (`--` 없으면 npm이 플래그를 먹는다) |
| `npm run verify` | **배포 게이트** — mock 상태·placeholder 잔존·이미지 베이스 URL 미설정·커버/og-image R2 도달 불가 시 실패 |

## 고객 정보 관리 원칙
- 모든 고객 정보는 `src/invite.ts`의 `INVITE` 상수 **한 곳에서만** 관리한다. 하드코딩 중복 금지
- **계좌번호·혼주 성함은 리포에 두지 않는다.** 로컬 `.env` + Vercel 환경변수로만 주입하고, `src/invite.ts`에는 폴백용 mock만 둔다 (형식: `.env.example`). 프라이빗 리포라도 이력에 남기지 않는다
- 예식 일시·장소·교통 안내처럼 청첩장에 공개되는 값은 `INVITE`에 직접 둔다
- **이 문서를 포함해 문서·주석·커밋 메시지에 고객 개인정보(실명, 계좌번호, 연락처)를 적지 않는다**
- 개인정보는 고객이 서면(메시지)으로 확정한 값만 반영. 추측·임의 기입 금지
- 날짜는 ISO 형식 + KST 명시 (`YYYY-MM-DDTHH:mm:00+09:00`) — D-Day·OG 태그·지도 링크가 모두 이 값에 연동되어야 한다

## 디자인 토큰 (c안 확정값)

### 색상
| 토큰 | 값 | 용도 |
|---|---|---|
| primary | `#7e9079` | 포인트 그린: 섹션 타이틀, 버튼, 달력의 예식일 원, D-Day 「초」 박스 |
| bg | `#f5f3ea` | 페이지 배경 |
| card | `#fffefb` | 카드 배경 |
| text | `#3a3631` | 제목 |
| text-body | `#4a463e` | 본문 |
| text-sub | `#7a766b` | 보조 텍스트 |
| muted | `#a7a496`, `#9aa18d` | 캡션, 라벨 |
| surface | `#f2f4ec` | 연녹색 박스 (D-Day, 버튼) |
| surface-2 | `#eef1e8`, `#f7f9f3` | 옅은 버튼, 아코디언 |
| input-bg / border | `#fbfcf8` / `#e6e8dd` | 입력 필드 |
| on-primary | `#f7f8f1` (보조 `#e2e8d8`, `#e7ecde`) | 그린 배경 위 텍스트 |
| on-surface | `#5f7060` | 연녹색 박스(surface) 위 텍스트 — 지도 앱 버튼 |
| overlay | `#282e26` @ 94% | 라이트박스 배경 |

### 타이포그래피
| 폰트 | 용도 | 크기 위계 |
|---|---|---|
| Parisienne | 영문 섹션 타이틀 전용 | 커버 30 / 푸터 34 / 섹션 24~26 |
| Nanum Myeongjo | 국문 전체 (제목·본문·버튼) | 이름 30(700) / 날짜 27(700) / 본문 16.5 / 보조 14 / 버튼 13~15 |
| Gowun Dodum | 커버 날짜 캡션 전용 | 11, letter-spacing 0.4em |

> **초대글 카드만 본문 14.5 · 인용 시 13.5 · 좌우 패딩 26**이다(2026-08-11). 받은 인사말에 한 줄이 23자인 문단이 있어 16.5로는 375px에서 마지막 낱말만 다음 줄에 홀로 남았고, 고객이 지정한 줄바꿈이 무너졌다. 375px에서 원문대로 앉는 최대 크기를 실측해 정한 값이라 **문구가 바뀌면 다시 재야 한다** — `e2e/smoke.spec.ts`가 이 줄바꿈을 지킨다.

### 레이아웃 규칙
- 최대 폭 **430px**, 중앙 정렬. 카드: 좌우 마진 20, radius 24
- 사진 비율 **4:5** 고정 (커버는 아치형: 상단 radius 200 / 하단 18)
- 지도 16:10, 버튼·입력 필드 radius 14
- **갤러리는 가로 슬라이드** (2026-08-06 고객 확정 — c안의 2열 그리드에서 변경). 자리는 4:5로 고정하되 사진은 잘리지 않게 안에 맞추고(원본이 가로·세로·필름 스트립으로 섞여 있다), 양옆 사진이 22px 걸쳐 보인다. 사진 radius 18
- 섹션 순서: 커버 → 초대글 → **Calendar** → 갤러리(14장) → 오시는길 → 마음전하기 → RSVP → 푸터
  - Calendar 한 카드가 달력·예식 일시·예식장·캘린더 저장·D-Day를 모두 담는다 (2026-08-11 고객 확정 — c안의 When&Where 그린 카드와 D-Day 카드를 합쳤다). 이 변경으로 페이지에 그린 배경 카드는 남아 있지 않다
- 오버레이 2종: 토스트 / RSVP 완료 카드 — **라이트박스는 만들지 않는다** (고객이 확대·줌 거절, `GL-02` 미채택)

### 애니메이션
- 스크롤 리빌: `Reveal` 컴포넌트(`whileInView`, translateY 22px + fade 0.9s) 공통 사용
- 커버 패럴랙스, D-Day 1초 카운트다운, 라이트박스 스와이프(`drag`), 오버레이 전환(`AnimatePresence`)
- `prefers-reduced-motion` 대응은 `MotionConfig reducedMotion="user"`로 처리 — 제거 금지

## 고객 요청 유형별 대응

| 요청 | 대응 위치 | 주의 |
|---|---|---|
| 문구 수정 (초대글 등) | `INVITE` 상수 | 줄바꿈 위치까지 고객 확인 |
| 사진 교체/추가 | 원본 → `npm run optimize` → `npm run upload:images` | 4:5 크롭 결과를 고객에게 확인. 파일명을 유지하면 코드 변경이 필요 없다 |
| 색감 변경 | 색상 토큰만 일괄 치환 | 개별 요소 색만 바꾸지 않는다 |
| 계좌 등록/수정 | `INVITE` 상수 | 커밋 전 계좌번호·예금주 고객 재확인 필수 |
| 섹션 추가/순서 변경 | 섹션 컴포넌트 단위로 | 카드 패턴(radius 24, 마진 20) 유지 |
| 시간/장소 변경 | `INVITE.dateISO` 등 | OG 태그·D-Day·지도 링크 연동 확인 |

## 절대 규칙
1. **배포 게이트**: placeholder(`○○`, `000-000-000000`, `4:5`, `MAP PREVIEW`)가 남아 있으면 배포 금지
2. **검토 게이트**: PR 전 `npm run review:branch` 통과 + `/code-review` 수행. 이 리포는 프라이빗 무료 플랜이라 브랜치 보호·시크릿 스캐닝을 쓸 수 없어 이 게이트가 유일한 방어선이다
3. **이미지**: 정적 이미지는 **예외 없이 전부 Cloudflare R2**에서 관리한다. 원본·WebP·`og-image.jpg` 모두 커밋 금지. R2 자격증명(`R2_*`)에는 `VITE_` 접두사를 붙이지 않는다 — 붙이면 시크릿 키가 클라이언트 번들에 박힌다
4. **삭제 금지**: 파일 삭제는 사용자 승인 필수
5. 응답·커밋 메시지·주석 모두 한국어, 존댓말

## 배포 전 체크리스트

실기기 확인의 전체 목록은 **`docs/manual-qa.md`** 에 있다. 아래는 그중 매 배포마다 반드시 보는 것들이다.

- [ ] 카톡 공유 미리보기 확인 (OG 태그, 카카오 디버거로 캐시 갱신)
- [ ] iOS Safari / Android Chrome 실기기 확인
- [ ] D-Day 카운트다운 정상 동작 (KST 기준)
- [ ] RSVP 제출 → 수신처(스프레드시트) 도착 확인
- [ ] 지도 3종 링크(네이버·카카오맵·티맵) 실기기에서 앱 연결 확인 — 좌표가 예식장을 가리키는지 함께 확인
- [ ] Kakao Developers 콘솔에 배포 도메인 등록 (미등록이면 지도만 정적 안내로 빠진다)
- [ ] 계좌 복사 버튼 → 실제 클립보드 값 확인
- [ ] 「캘린더에 저장」 → **카카오톡 인앱 브라우저**에서 .ics 다운로드가 막히지 않는지 확인. iOS·안드로이드 기본 캘린더에 11시로 들어가는지도 함께 본다 (막히면 구글 캘린더 링크 병행)
