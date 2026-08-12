'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchDiscoverPage, fetchDiscoverMeta, type Cursor } from '@/lib/profiles';
import type { Profile } from '@/lib/types';

export function useDiscover() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const cursorRef = useRef<Cursor>(null);
  const startedRef = useRef(false);
  // Guards against overlapping loadInitial calls — e.g. 'visibilitychange'
  // and 'focus' both firing when the tab regains focus.
  const inFlightRef = useRef(false);

  const loadInitial = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      // Fetched fresh (not cached) so a block/hide recorded elsewhere — another
      // tab, the mobile app — during a long-lived session is honored rather
      // than working off a stale snapshot. users/{uid} is a small doc; the
      // extra read per page is worth the correctness guarantee.
      const meta = await fetchDiscoverMeta();
      const page = await fetchDiscoverPage(null, meta);
      setProfiles(page.profiles);
      cursorRef.current = page.cursor;
      setHasMore(page.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      // Re-resolved on every page for the same reason as loadInitial above —
      // never reuse a cached blockedUids/hiddenProfileIds snapshot.
      const meta = await fetchDiscoverMeta();
      const page = await fetchDiscoverPage(cursorRef.current, meta);
      setProfiles((prev) => [...prev, ...page.profiles]);
      cursorRef.current = page.cursor;
      setHasMore(page.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore]);

  useEffect(() => {
    if (startedRef.current) return; // guard React 18/19 StrictMode double-effect
    startedRef.current = true;
    void loadInitial();
  }, [loadInitial]);

  // Re-fetch when the tab/window becomes active again so a profile deleted
  // or hidden by admin while this tab was backgrounded doesn't linger —
  // no polling, just event-driven refresh on actual return-to-tab.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') void loadInitial();
    }
    function handleFocus() {
      void loadInitial();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadInitial]);

  return { profiles, loading, loadingMore, error, hasMore, loadMore, reload: loadInitial };
}
