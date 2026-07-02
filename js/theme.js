/**
 * Light/dark theme manager.
 *
 * The theme is applied via a `data-theme` attribute on <html>. Toggling is
 * intentionally instant: a `.no-transition` class is applied around the swap so
 * no CSS transitions animate during a theme change.
 */

import { STORAGE, THEME_COLOR } from './constants.js';
import { readStorage, writeStorage } from './storage.js';

export class ThemeManager {
  /**
   * @param {{ root?: HTMLElement, meta?: HTMLMetaElement|null }} [options]
   */
  constructor({ root = document.documentElement, meta = null } = {}) {
    this.root = root;
    this.meta = meta;
  }

  /** @returns {'light'|'dark'} */
  get current() {
    return this.root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  /** Apply the stored theme, or fall back to the OS preference. */
  init() {
    const stored = readStorage(STORAGE.THEME);
    const preferred = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    this.set(stored === 'light' || stored === 'dark' ? stored : preferred);
  }

  toggle() {
    this.set(this.current === 'dark' ? 'light' : 'dark');
  }

  /** @param {'light'|'dark'} theme */
  set(theme) {
    this.root.classList.add('no-transition');
    this.root.setAttribute('data-theme', theme);
    void this.root.offsetWidth; // force reflow so the swap applies with transitions off
    this.root.classList.remove('no-transition');

    this.meta?.setAttribute('content', THEME_COLOR[theme]);
    writeStorage(STORAGE.THEME, theme);
  }
}
