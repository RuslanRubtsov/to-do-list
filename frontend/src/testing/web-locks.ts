/**
 * A stand-in for the browser's Web Locks API (`navigator.locks`), which jsdom lacks. Like the real
 * one, it grants each named lock to one holder at a time, in the order they asked, and releases it
 * when the holder's callback settles. Other tabs are simulated with {@link holdBrowserLock}.
 */
class FakeLockManager {
  private readonly tails = new Map<string, Promise<unknown>>();

  request<T>(name: string, callback: () => Promise<T> | T): Promise<T> {
    const granted = (this.tails.get(name) ?? Promise.resolve()).then(() => callback());
    this.tails.set(
      name,
      granted.catch(() => undefined),
    );
    return granted;
  }
}

export function emulateWebLocks(): void {
  Object.defineProperty(navigator, 'locks', { value: new FakeLockManager(), configurable: true });
}

/** Takes a lock as another tab would, until told to release it. */
export function holdBrowserLock(name: string): { release: () => void } {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  void navigator.locks.request(name, () => held);
  return { release };
}
