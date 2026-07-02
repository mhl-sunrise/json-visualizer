/**
 * The JSON text editor: a transparent <textarea> layered over a syntax-
 * highlighted <pre>, kept in sync on input and scroll.
 */

import { highlightJSON } from './highlight.js';
import { LIMITS } from './constants.js';

export class JsonEditor {
  /**
   * @param {{
   *   textarea: HTMLTextAreaElement,
   *   highlight: HTMLElement,   // the <code> that receives highlighted HTML
   *   onChange: () => void,     // fired (undebounced) on every edit
   *   highlightMax?: number,    // above this length, skip highlighting for speed
   * }} refs
   */
  constructor({ textarea, highlight, onChange, highlightMax = LIMITS.HIGHLIGHT_MAX }) {
    this.textarea = textarea;
    this.highlight = highlight;
    this.onChange = onChange;
    this.highlightMax = highlightMax;

    textarea.addEventListener('input', () => this._handleInput());
    textarea.addEventListener('scroll', () => this._syncScroll());
    textarea.addEventListener('keydown', (e) => this._handleKeydown(e));
  }

  /** @returns {string} */
  get value() {
    return this.textarea.value;
  }

  /** @param {string} next */
  set value(next) {
    this.textarea.value = next;
    this.repaint();
  }

  focus() {
    this.textarea.focus();
  }

  /** Re-render the highlight layer. Trailing newline keeps the last line visible. */
  repaint() {
    const value = this.textarea.value;
    if (value.length > this.highlightMax) {
      // Plain (escaped) text — avoids running the tokeniser on huge inputs.
      this.highlight.textContent = value + '\n';
    } else {
      this.highlight.innerHTML = highlightJSON(value) + '\n';
    }
  }

  _handleInput() {
    this.repaint();
    this.onChange();
  }

  _syncScroll() {
    const pre = this.highlight.parentElement;
    pre.scrollTop = this.textarea.scrollTop;
    pre.scrollLeft = this.textarea.scrollLeft;
  }

  /** Insert two spaces on Tab instead of moving focus. */
  _handleKeydown(e) {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const { selectionStart: start, selectionEnd: end, value } = this.textarea;
    this.textarea.value = value.slice(0, start) + '  ' + value.slice(end);
    this.textarea.selectionStart = this.textarea.selectionEnd = start + 2;
    this._handleInput();
  }
}
