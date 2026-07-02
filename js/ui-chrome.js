/**
 * Non-diagram UI wiring: the mobile burger menu, the mobile pane tabs, and the
 * draggable sidebar divider (desktop).
 */

import { SIDEBAR, STORAGE } from './constants.js';
import { readStorage, writeStorage } from './storage.js';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * Wire the collapsible actions menu (burger) shown on small screens.
 * @param {{ burger: HTMLElement, menu: HTMLElement }} refs
 */
export function initBurgerMenu({ burger, menu }) {
  const close = () => {
    menu.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
  };

  burger.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = menu.classList.toggle('open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // Close when an action is chosen or when clicking outside.
  menu.addEventListener('click', (e) => {
    if (/** @type {HTMLElement} */ (e.target).closest('button')) close();
  });
  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('open')) return;
    const target = /** @type {Node} */ (e.target);
    if (!menu.contains(target) && !burger.contains(target)) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}

/**
 * Wire the mobile JSON/Diagram tab switcher.
 * @param {{ workspace: HTMLElement, tabs: NodeListOf<HTMLElement>, onShow?: (pane: string) => void }} refs
 */
export function initMobileTabs({ workspace, tabs, onShow }) {
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const pane = tab.dataset.pane;
      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      workspace.setAttribute('data-mobile-pane', pane);
      onShow?.(pane);
    });
  });
}

/**
 * Wire the draggable divider that resizes the editor pane (desktop only).
 * Persists the chosen width across sessions.
 * @param {{ divider: HTMLElement, editorPane: HTMLElement, workspace: HTMLElement }} refs
 */
export function initResizer({ divider, editorPane, workspace }) {
  /** Apply a width percentage and reflect it on the ARIA separator. */
  const apply = (pct) => {
    const value = clamp(pct, SIDEBAR.MIN, SIDEBAR.MAX);
    editorPane.style.flexBasis = `${value}%`;
    divider.setAttribute('aria-valuenow', String(Math.round(value)));
    return value;
  };

  const saved = readStorage(STORAGE.SIDEBAR);
  if (saved) apply(parseFloat(saved));

  let resizing = false;

  divider.addEventListener('pointerdown', (e) => {
    resizing = true;
    divider.classList.add('resizing');
    document.body.classList.add('resizing-h');
    try { divider.setPointerCapture(e.pointerId); } catch { /* capture unsupported — ignore */ }
    e.preventDefault();
  });

  divider.addEventListener('pointermove', (e) => {
    if (!resizing) return;
    const rect = workspace.getBoundingClientRect();
    apply(((e.clientX - rect.left) / rect.width) * 100);
  });

  const stop = () => {
    if (!resizing) return;
    resizing = false;
    divider.classList.remove('resizing');
    document.body.classList.remove('resizing-h');
    writeStorage(STORAGE.SIDEBAR, editorPane.style.flexBasis);
  };
  divider.addEventListener('pointerup', stop);
  divider.addEventListener('pointercancel', stop);

  // Keyboard operability for the focusable separator.
  divider.addEventListener('keydown', (e) => {
    const step = e.key === 'ArrowLeft' ? -2 : e.key === 'ArrowRight' ? 2 : 0;
    if (!step) return;
    e.preventDefault();
    const current = parseFloat(divider.getAttribute('aria-valuenow')) || SIDEBAR.DEFAULT;
    apply(current + step);
    writeStorage(STORAGE.SIDEBAR, editorPane.style.flexBasis);
  });
}
