import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { mediaMatches, SYSTEM_DARK_QUERY } from './media';

export type Theme = 'light' | 'dark';

/** Where this browser remembers the person's theme choice. */
export const THEME_STORAGE_KEY = 'todo.theme';

/**
 * Light or dark: the system preference until the person picks one, which this browser then
 * remembers. Material's theme follows the root element's `color-scheme`.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly systemDark = mediaMatches(SYSTEM_DARK_QUERY);
  private readonly chosen = signal<Theme | null>(rememberedTheme());

  readonly current = computed<Theme>(() => this.chosen() ?? (this.systemDark() ? 'dark' : 'light'));

  constructor() {
    const root = inject(DOCUMENT).documentElement;
    effect(() => applyTheme(root, this.chosen()));
  }

  toggle(): void {
    const next: Theme = this.current() === 'dark' ? 'light' : 'dark';
    this.chosen.set(next);
    rememberTheme(next);
  }
}

/** Sets the theme on the root element; `null` leaves the stylesheet's `light dark` (the system's). */
export function applyTheme(root: HTMLElement, theme: Theme | null): void {
  root.style.colorScheme = theme ?? '';
}

// Storage can be unavailable (private browsing, blocked cookies): the theme then lasts for the visit

/** The theme this browser remembers choosing, if any. */
export function rememberedTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
}

function rememberTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Nothing to do: the choice still applies until the page is closed
  }
}
