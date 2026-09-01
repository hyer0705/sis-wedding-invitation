import { useEffect, useRef } from "react";
import { AnimatePresence, m } from "motion/react";

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
export default function Step({ show, children }: { show: boolean; children: React.ReactNode }) {
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
    //
    // "nearest" 는 화면에 걸친 칸을 **뷰포트 맨 아래에 붙이는데**, 화면 아래 글자 크기
    // 바가 그 자리를 덮는다. global.css 의 html { scroll-padding-bottom } 이 바 높이만큼
    // 앞당겨 멈추게 한다 — 그 규칙을 지우면 새로 나타난 칸이 바 뒤로 들어간다.
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
