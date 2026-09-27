import type { Channel } from './types';
export function channel<T>(initial: T) {
  let value = initial;
  let disposed = false;
  const subscriptions = new Set<{ notify(): void; cancel(): void }>();
  const api: Channel<T> = {
    getSnapshot: () => value,
    subscribe(handler, options = {}) {
      const delay = options.throttle ?? 0;
      if (!Number.isFinite(delay) || delay < 0) throw new RangeError('throttle must be a finite non-negative number');
      if (disposed) return () => {};
      let last = -Infinity;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const emit = () => { timer = undefined; last = Date.now(); handler(value); };
      const sub = {
        notify() {
          const remaining = delay - (Date.now() - last);
          if (remaining <= 0) { if (timer !== undefined) clearTimeout(timer); emit(); }
          else if (timer === undefined) timer = setTimeout(emit, remaining);
        },
        cancel() { if (timer !== undefined) clearTimeout(timer); timer = undefined; last = -Infinity; },
      };
      subscriptions.add(sub);
      return () => { sub.cancel(); subscriptions.delete(sub); };
    },
  };
  return {
    api,
    publish(next: T) { if (disposed) return; value = next; for (const sub of [...subscriptions]) sub.notify(); },
    cancelPending() { for (const sub of subscriptions) sub.cancel(); },
    dispose() { disposed = true; for (const sub of subscriptions) sub.cancel(); subscriptions.clear(); },
  };
}
