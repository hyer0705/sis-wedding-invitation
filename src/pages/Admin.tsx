// SIS-38 — 관리자 페이지(/admin). AD-01 · RS-04. 시안 확정 2026-08-19.
//
// 이 파일은 **문지기와 탭 껍데기**만 맡는다. 회신 화면은 AdminRsvp.tsx 에 있다.
//
// 배선은 SIS-22 가 끝내 두었다. 화면은 아래 함수들을 부르기만 한다.
//   src/lib/adminAuth.ts   signIn · signOut · isAdmin · currentSession · onAuthChange
//   src/lib/adminRsvp.ts   listRsvp · deleteRsvp · summarize
//   src/lib/csv.ts         toRsvpCsv · rsvpCsvBlob · rsvpCsvFileName
//
// ★ **목록을 그리기 전에 isAdmin() 을 먼저 본다.** RLS 는 권한이 없으면 오류가 아니라
//   빈 목록을 주므로(supabase/schema.sql), 건너뛰면 등록되지 않은 계정에 「아직 회신이
//   없어요」가 뜬다. signIn 은 로그인 직후 이미 확인하지만, **세션이 남은 채 새로고침해
//   들어오는 경로**가 따로 있어 여기서 한 번 더 본다.
import { useCallback, useEffect, useId, useState } from "react";
import { currentSession, isAdmin, onAuthChange, signIn, signOut } from "../lib/adminAuth";
import AdminRsvp from "./AdminRsvp";
import "../styles/admin.css";

/** index.html 의 부트 화면. 청첩장 쪽은 Loading.tsx 가 걷는다. */
const BOOT_ID = "boot";

/**
 * 화면을 가르는 상태.
 *
 * 「확인중」이 따로 있는 것은, 세션을 읽고 권한까지 묻는 동안 로그인 화면을 잠깐
 * 보였다가 목록으로 바뀌는 깜빡임을 막기 위해서다. 그동안은 부트 화면이 그대로
 * 떠 있다.
 */
type Gate = "확인중" | "로그인필요" | "권한없음" | "관리자" | "오류";

type Tab = "회신" | "방명록";

export default function Admin() {
  const [gate, setGate] = useState<Gate>("확인중");
  const [gateError, setGateError] = useState("");
  const [tab, setTab] = useState<Tab>("회신");

  // 세션을 보고 권한까지 확인한다. 로그인·로그아웃·토큰 갱신 때마다 다시 돈다 —
  // 탭을 두 개 열어 둔 경우까지 맞추기 위한 것이다(adminAuth.ts 의 onAuthChange).
  useEffect(() => {
    let alive = true;

    async function check() {
      try {
        const session = await currentSession();
        if (!alive) return;
        if (!session) {
          setGate("로그인필요");
          return;
        }

        const admin = await isAdmin();
        if (!alive) return;
        setGate(admin ? "관리자" : "권한없음");
      } catch (cause) {
        if (!alive) return;
        // 회신 내용은 절대 싣지 않는다. 여기서 실패하는 것은 권한 확인이고,
        // 메시지에도 하객 정보가 들어갈 자리가 없다.
        setGateError(cause instanceof Error ? cause.message : "관리자 확인에 실패했습니다");
        setGate("오류");
      }
    }

    void check();
    const unsubscribe = onAuthChange(() => {
      setGate("확인중");
      void check();
    });

    return () => {
      // 확인이 도는 중에 화면을 벗어나면 결과를 버린다. 걷지 않으면 사라진 화면에
      // 상태를 얹으려 든다.
      alive = false;
      unsubscribe();
    };
  }, []);

  // 확인이 끝나면 부트 화면을 걷는다. 먼저 걷으면 확인이 끝날 때까지 빈 화면이 뜬다.
  useEffect(() => {
    if (gate !== "확인중") document.getElementById(BOOT_ID)?.remove();
  }, [gate]);

  if (gate === "확인중") return null;

  return (
    <main className="page">
      <div className="admin">
        {gate === "로그인필요" && <Login />}
        {gate === "권한없음" && <NotRegistered />}
        {gate === "오류" && <GateError message={gateError} />}
        {gate === "관리자" && <Dashboard tab={tab} onTab={setTab} />}
      </div>
    </main>
  );
}

/** 로그인 화면. 비밀번호는 어디에도 저장하지 않고 signIn 에 넘기기만 한다. */
function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending) return;

    if (email.trim() === "" || password === "") {
      setError("이메일과 비밀번호를 모두 입력해 주세요.");
      return;
    }

    setSending(true);
    setError("");
    try {
      // 성공하면 onAuthChange 가 화면을 바꾼다. 여기서 상태를 옮기지 않는 것은,
      // signIn 이 권한까지 확인하고 아니면 로그아웃해 버리기 때문이다.
      await signIn(email.trim(), password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "로그인에 실패했습니다");
      setSending(false);
    }
  }

  return (
    <form className="admin-card admin-login" onSubmit={submit} noValidate>
      <h1>관리자 로그인</h1>
      <p>회신과 방명록을 보려면 로그인이 필요합니다.</p>

      <div className="admin-field">
        <label className="admin-label" htmlFor={emailId}>
          이메일
        </label>
        <input
          id={emailId}
          className={`admin-input${error ? " admin-invalid" : ""}`}
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-describedby={error ? errorId : undefined}
        />
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor={passwordId}>
          비밀번호
        </label>
        <input
          id={passwordId}
          className={`admin-input${error ? " admin-invalid" : ""}`}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby={error ? errorId : undefined}
        />
      </div>

      {/* 오류는 색이 아니라 글로 알린다. role="alert" 로 스크린리더에도 곧바로 읽힌다. */}
      {error && (
        <p id={errorId} className="admin-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="admin-btn admin-btn-primary" disabled={sending}>
        {sending ? "확인하는 중…" : "로그인"}
      </button>
    </form>
  );
}

/**
 * 로그인은 됐지만 admin_users 에 없는 계정.
 *
 * 자주 보게 될 화면이 아니라 **설정이 어긋난 것을 알려 주는 자리**다. 이 화면이
 * 없으면 같은 상태가 「아직 회신이 없어요」로 보이고, 예식 직전에 그것을 보면
 * 하객이 아무도 회신하지 않은 줄 알게 된다.
 */
function NotRegistered() {
  return (
    <div className="admin-card admin-login">
      <h1>아직 관리자로 등록되지 않았습니다</h1>
      <p>
        로그인은 됐지만 이 계정은 회신을 볼 수 없습니다.
        <br />
        관리자 등록 후 다시 로그인해 주세요.
      </p>
      <LogoutButton className="admin-btn admin-btn-ghost">로그아웃</LogoutButton>
    </div>
  );
}

/** 세션·권한 확인 자체가 실패한 경우 (네트워크·Supabase 장애). */
function GateError({ message }: { message: string }) {
  return (
    <div className="admin-card admin-login">
      <h1>확인에 실패했습니다</h1>
      <p className="admin-error" role="alert">
        {message}
      </p>
      <button type="button" className="admin-btn admin-btn-primary" onClick={() => window.location.reload()}>
        다시 시도
      </button>
    </div>
  );
}

function LogoutButton({ className, children }: { className: string; children: React.ReactNode }) {
  const [error, setError] = useState("");

  async function logout() {
    try {
      // 성공하면 onAuthChange 가 로그인 화면으로 되돌린다.
      await signOut();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "로그아웃에 실패했습니다");
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={logout}>
        {children}
      </button>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

/** 탭 껍데기. 방명록 칸은 SIS-21 이 백엔드를 세운 뒤 채운다. */
function Dashboard({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  const [count, setCount] = useState<number>();
  const rsvpTabId = useId();
  const guestbookTabId = useId();
  const panelId = useId();

  // 탭에 붙는 건수는 목록이 알려 준다. 같은 목록을 두 번 읽지 않기 위해서다.
  const report = useCallback((value: number) => setCount(value), []);

  return (
    <>
      <div className="admin-top">
        <h1 className="admin-title">관리자</h1>
        <LogoutButton className="admin-linkish">로그아웃</LogoutButton>
      </div>

      <div className="admin-tabs" role="tablist" aria-label="관리 항목">
        <button
          type="button"
          id={rsvpTabId}
          className="admin-tab"
          role="tab"
          aria-selected={tab === "회신"}
          aria-controls={tab === "회신" ? panelId : undefined}
          onClick={() => onTab("회신")}
        >
          회신 {count !== undefined && <span className="admin-tab-count">{count}</span>}
        </button>
        <button
          type="button"
          id={guestbookTabId}
          className="admin-tab"
          role="tab"
          aria-selected={tab === "방명록"}
          aria-controls={tab === "방명록" ? panelId : undefined}
          onClick={() => onTab("방명록")}
        >
          방명록
        </button>
      </div>

      <div id={panelId} role="tabpanel" aria-labelledby={tab === "회신" ? rsvpTabId : guestbookTabId}>
        {tab === "회신" ? <AdminRsvp onCount={report} /> : <GuestbookPlaceholder />}
      </div>
    </>
  );
}

/**
 * 방명록 자리. **SIS-38 에서는 채우지 않는다.**
 *
 * 방명록(SIS-21)은 아직 테이블도 함수도 없다 — supabase/schema.sql 에 RSVP 와 관리자
 * 접근만 들어 있다. 탭을 미리 두는 것은 그때 구조를 다시 짜지 않기 위해서다.
 */
function GuestbookPlaceholder() {
  return (
    <div className="admin-card">
      <p className="admin-empty">
        <strong>방명록은 준비 중입니다</strong>
        하객이 남긴 축하 메시지를
        <br />
        여기에서 보고 지울 수 있게 됩니다.
      </p>
    </div>
  );
}
