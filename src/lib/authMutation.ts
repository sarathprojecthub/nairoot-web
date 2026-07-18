type Listener = (pending: boolean) => void;

let pending = false;
const listeners = new Set<Listener>();

export function isAuthMutationPending(): boolean {
  return pending;
}

export function setAuthMutationPending(next: boolean): void {
  if (pending === next) return;
  pending = next;
  listeners.forEach((listener) => listener(pending));
}

export function subscribeAuthMutation(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
