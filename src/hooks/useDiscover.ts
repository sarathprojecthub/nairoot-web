'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchDiscoverPage, type Cursor } from '@/lib/profiles';
import type { Profile } from '@/lib/types';

export function useDiscover() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const cursorRef = useRef<Cursor>(null);
  const startedRef = useRef(false);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchDiscoverPage(null);
      setProfiles(page.profiles);
      cursorRef.current = page.cursor;
      setHasMore(page.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchDiscoverPage(cursorRef.current);
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

  return { profiles, loading, loadingMore, error, hasMore, loadMore, reload: loadInitial };
}
