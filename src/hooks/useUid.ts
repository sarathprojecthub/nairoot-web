'use client';

import { useAuth } from '@/components/AuthProvider';

// Current signed-in uid (or null while signed out / before auth resolves).
// Sourced from the AuthProvider — the production Phone-Auth session, which the
// SDK persists across reloads, so this uid is stable per member (not per browser).
export function useUid(): string | null {
  return useAuth().user?.uid ?? null;
}
