import { useCallback, useEffect, useId, useState } from "react";
import { currentSession, isAdmin, onAuthChange, signIn, signOut } from "../lib/adminAuth";
import AdminRsvp from "./AdminRsvp";
import "../styles/admin.css";

const BOOT_ID = "boot";

type Gate = "확인중" | "로그인필요" | "권한없음" | "관리자" | "오류";

type Tab = "회신" | "방명록";

export default function Admin() {
  const [gate, setGate] = useState<Gate>("확인중");
  const [gateError, setGateError] = useState("");
  const [tab, setTab] = useState<Tab>("회신");

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

        setGateError(cause instanceof Error ? cause.message : "관리자 확인에 실패했습니다");
        setGate("오류");
      }
    }

    void check();
    const unsubscribe = onAuthChange((session) => {
      if (!session) {
        setGate("로그인필요");
        return;
      }
      void check();
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

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

function Dashboard({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  const [count, setCount] = useState<number>();
  const rsvpTabId = useId();
  const guestbookTabId = useId();
  const panelId = useId();

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
