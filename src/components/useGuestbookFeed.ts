import { useCallback, useEffect, useRef, useState } from "react";
import { fetchGuestbookPage, type GuestbookEntry } from "../lib/guestbook";

export type FeedState = "loading" | "ready" | "failed";

export interface GuestbookFeed {
  entries: GuestbookEntry[];
  state: FeedState;
  hasMore: boolean;
  loadingMore: boolean;
  reload: () => Promise<void>;
  loadMore: () => Promise<boolean>;
  forgetEntry: (id: string) => void;
}

export function useGuestbookFeed(size: number): GuestbookFeed {
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [state, setState] = useState<FeedState>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const inFlight = useRef<AbortController | null>(null);

  const startRequest = useCallback(() => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    return controller.signal;
  }, []);

  const reload = useCallback(async () => {
    const signal = startRequest();

    try {
      const page = await fetchGuestbookPage(null, size, signal);
      if (signal.aborted) return;

      setEntries(page.entries);
      setCursor(page.nextCursor);
      setState("ready");
    } catch {
      if (!signal.aborted) setState("failed");
    }
  }, [size, startRequest]);

  useEffect(() => {
    void reload();
    return () => inFlight.current?.abort();
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (!cursor) return true;

    const signal = startRequest();
    setLoadingMore(true);

    try {
      const page = await fetchGuestbookPage(cursor, size, signal);
      if (signal.aborted) return true;

      setEntries((current) => [...current, ...page.entries]);
      setCursor(page.nextCursor);
      return true;
    } catch {
      return signal.aborted;
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, size, startRequest]);

  const forgetEntry = useCallback((id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, []);

  return { entries, state, hasMore: cursor !== null, loadingMore, reload, loadMore, forgetEntry };
}
