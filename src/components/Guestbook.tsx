import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import Reveal from "./Reveal";
import GuestbookList from "./GuestbookList";
import GuestbookWriteDialog from "./GuestbookWriteDialog";
import { useGuestbookFeed } from "./useGuestbookFeed";
import { MAIN_VISIBLE_COUNT } from "../lib/guestbook";
import { openGuestbook, subscribeRoute } from "../lib/navigation";

const TITLE = "Guest book";
const LEAD = "축하의 한마디를 남겨 주세요";
const EMPTY = "아직 남겨진 축하 메시지가 없어요\n첫 마디를 전해 주세요";
const FAILED = "축하 메시지를 불러오지 못했어요\n잠시 뒤 다시 열어 주세요";
const WRITE_LABEL = "축하 메시지 남기기";
const ALL_LABEL = "전체보기";

export default function Guestbook() {
  const { entries, state, hasMore, reload } = useGuestbookFeed(MAIN_VISIBLE_COUNT);
  const [writing, setWriting] = useState(false);

  useEffect(
    () =>
      subscribeRoute((route) => {
        if (route === "invitation") void reload();
      }),
    [reload],
  );

  return (
    <Reveal>
      <div className="card" style={{ padding: "38px 26px 30px" }}>
        <div className="script-title">{TITLE}</div>
        <div style={{ width: 34, height: 1, background: "var(--input-border)", margin: "18px auto 20px" }} />
        <p className="gb-lead">{LEAD}</p>

        {/* 읽어 둔 글이 있으면 그것을 계속 보여준다. 작성 직후의 갱신이 실패했다고
            방금 남긴 글까지 안내 문구로 덮으면, 저장은 됐는데 안 된 것으로 보여
            하객이 같은 글을 한 번 더 남긴다. */}
        {state === "failed" && entries.length === 0 && <p className="gb-note">{FAILED}</p>}
        {state === "ready" && entries.length === 0 && <p className="gb-note">{EMPTY}</p>}
        {/* 메인은 지운 뒤 다시 읽는다. 최신 다섯 건을 보이는 자리라 한 건이 빠지면
            여섯 번째가 올라와야 한다 — 쌓아 둔 쪽이 없어 되감길 것도 없다.
            전체보기는 반대로 그 항목만 뺀다(GuestbookAll.tsx). */}
        {entries.length > 0 && <GuestbookList entries={entries} onDeleted={() => void reload()} />}

        <div className="gb-actions">
          <button type="button" className="gb-btn gb-btn-primary" onClick={() => setWriting(true)}>
            {WRITE_LABEL}
          </button>
          {hasMore && (
            <button type="button" className="gb-btn" onClick={openGuestbook}>
              {ALL_LABEL}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {writing && (
          <GuestbookWriteDialog
            key="gb-write"
            onClose={() => setWriting(false)}
            onCreated={() => {
              setWriting(false);
              void reload();
            }}
          />
        )}
      </AnimatePresence>
    </Reveal>
  );
}
