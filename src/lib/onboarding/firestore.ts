// Shared Firestore write helper.
//
// The Android native SDK rejects `undefined` field values; the JS Web SDK
// silently drops them. We strip them here anyway so the documents the website
// writes are byte-identical to Android's (which uses the same omitUndefined()).
export function omitUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as T;
}
