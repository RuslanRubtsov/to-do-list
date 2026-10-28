/** What the fake browser reports to `window.matchMedia`. */
export interface Media {
  /** Viewport width in CSS pixels. */
  width: number;
  /** The operating system's light/dark preference. */
  prefersDark: boolean;
}

export const PHONE: Media = { width: 390, prefersDark: false };
export const DESKTOP: Media = { width: 1280, prefersDark: false };

/**
 * Replaces `window.matchMedia` (which jsdom lacks) with one answering width and
 * `prefers-color-scheme` queries from `media`. Call before rendering: Angular CDK reads it when its
 * services are created. Returns a function that changes the media, notifies listeners and waits
 * out the macrotask CDK's BreakpointObserver debounces changes by.
 */
export function emulateMedia(media: Media): (changes: Partial<Media>) => Promise<void> {
  let current = { ...media };
  const lists = new Set<FakeMediaQueryList>();

  window.matchMedia = (query: string) => {
    const list = new FakeMediaQueryList(query, () => current);
    lists.add(list);
    return list as unknown as MediaQueryList;
  };

  return async (changes) => {
    const before = new Map([...lists].map((list) => [list, list.matches]));
    current = { ...current, ...changes };
    for (const list of lists) {
      if (list.matches !== before.get(list)) list.notify();
    }
    await new Promise((resolve) => setTimeout(resolve));
  };
}

class FakeMediaQueryList {
  private readonly listeners = new Set<(event: MediaQueryListEvent) => void>();
  onchange: ((event: MediaQueryListEvent) => void) | null = null;

  constructor(
    readonly media: string,
    private readonly current: () => Media,
  ) {}

  get matches(): boolean {
    return this.media.split(/\s+and\s+/).every((condition) => holds(condition, this.current()));
  }

  addEventListener(_type: 'change', listener: (event: MediaQueryListEvent) => void): void {
    this.listeners.add(listener);
  }
  removeEventListener(_type: 'change', listener: (event: MediaQueryListEvent) => void): void {
    this.listeners.delete(listener);
  }
  addListener(listener: (event: MediaQueryListEvent) => void): void {
    this.listeners.add(listener);
  }
  removeListener(listener: (event: MediaQueryListEvent) => void): void {
    this.listeners.delete(listener);
  }

  notify(): void {
    const event = { matches: this.matches, media: this.media } as MediaQueryListEvent;
    this.onchange?.(event);
    this.listeners.forEach((listener) => listener(event));
  }
}

function holds(condition: string, media: Media): boolean {
  // "(feature: value)", or just "(feature)" for a boolean test
  const [, feature, value] = condition.match(/\(\s*([a-z-]+)\s*(?::\s*([^)]+?))?\s*\)/) ?? [];
  switch (feature) {
    case 'max-width':
      return media.width <= parseFloat(value);
    case 'prefers-color-scheme':
      return (value === 'dark') === media.prefersDark;
    case 'forced-colors':
      // CDK asks to detect Windows high-contrast mode; the fake browser isn't in it
      return value === 'none';
    case 'prefers-reduced-motion':
      // Material asks to decide on animations; the fake browser has no preference
      return value === 'no-preference';
    default:
      throw new Error(`emulateMedia can't answer "${condition}" yet; teach holds() about it`);
  }
}
