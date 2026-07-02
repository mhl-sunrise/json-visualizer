/**
 * The JSON text editor: a transparent <textarea> layered over a syntax-
 * highlighted <pre>, with a line-number gutter that supports code folding.
 *
 * Folding is view-only and safe: while any fold is active the textarea is
 * read-only, and `value` always returns the real, unfolded JSON — so the rest
 * of the app never sees the folded placeholder text.
 */

import { highlightJSON, addIndentGuides, escapeHtml } from './highlight.js';
import { buildFoldView } from './folding.js';
import { LIMITS } from './constants.js';

export class JsonEditor {
  /**
   * @param {{
   *   textarea: HTMLTextAreaElement,
   *   highlight: HTMLElement,   // the <code> that receives highlighted HTML
   *   gutter: HTMLElement,      // container for line numbers + fold controls
   *   onChange: () => void,     // fired (undebounced) on every edit
   *   highlightMax?: number,    // above this length, skip highlighting/folding
   * }} refs
   */
  constructor({ textarea, highlight, gutter, onChange, highlightMax = LIMITS.HIGHLIGHT_MAX }) {
    this.textarea = textarea;
    this.highlight = highlight;
    this.gutter = gutter;
    this.onChange = onChange;
    this.highlightMax = highlightMax;

    this._gutterKey = '';
    this._lastDigits = 0;
    // set --gutter-w on .editor-wrap so both the gutter and the error bar (a
    // sibling of the code stack) can read it
    this.editorWrap = textarea.closest('.editor-wrap');
    this.codeStack = textarea.closest('.code-stack');
    /** @type {Set<number>} folded opening-line indices (full-text coords) */
    this.folds = new Set();
    this._fullText = '';

    textarea.addEventListener('input', () => this._handleInput());
    textarea.addEventListener('scroll', () => this._syncScroll());
    textarea.addEventListener('keydown', (e) => this._handleKeydown(e));
    gutter.addEventListener('click', (e) => {
      const el = /** @type {HTMLElement} */ (e.target).closest('.gln-fold[data-line]');
      if (el) this.toggleFold(parseInt(el.getAttribute('data-line'), 10));
    });

    // when the editor width changes, lines re-wrap → re-align the gutter numbers
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => this._syncGutterHeights()).observe(textarea);
    }
  }

  /** The real, unfolded JSON text (source of truth for the rest of the app). */
  get value() {
    return this.folds.size ? this._fullText : this.textarea.value;
  }
  set value(next) {
    this.folds.clear();
    this.textarea.readOnly = false;
    this.textarea.value = next;
    this.repaint();
  }

  focus() {
    this.textarea.focus();
  }

  /**
   * Fold or unfold the block that opens on `line` (full-text index).
   * @param {number} line
   */
  toggleFold(line) {
    if (!this.folds.size) this._fullText = this.textarea.value; // capture before first fold
    if (this.folds.has(line)) this.folds.delete(line);
    else this.folds.add(line);

    if (this.folds.size) {
      this.textarea.readOnly = true;          // read-only while folded (safe)
    } else {
      this.textarea.readOnly = false;
      this.textarea.value = this._fullText;    // fully restored — editable again
    }
    this.repaint();
  }

  /** Re-render the highlight layer + gutter (applying folds when active). */
  repaint() {
    const source = this.folds.size ? this._fullText : this.textarea.value;
    const view = source.length <= this.highlightMax ? buildFoldView(source, this.folds) : null;

    if (this.folds.size && view) {
      const display = view.map((v) => v.text).join('\n');
      if (this.textarea.value !== display) this.textarea.value = display;
    }

    const display = this.textarea.value;
    const inner = display.length > this.highlightMax
      ? escapeHtml(display)
      : addIndentGuides(highlightJSON(display));
    // one block per line so wrapped lines have a measurable height
    this.highlight.innerHTML = inner
      .split('\n')
      .map((line) => `<div class="cl">${line || ' '}</div>`)
      .join('');

    this._renderGutter(view, display);
    this._syncGutterHeights();
  }

  /** Match each gutter line's height to its (possibly wrapped) code line. */
  _syncGutterHeights() {
    const lines = this.highlight.children;
    const nums = this.gutter.children;
    const n = Math.min(lines.length, nums.length);
    const heights = new Array(n);
    for (let i = 0; i < n; i++) heights[i] = lines[i].offsetHeight; // read (one reflow)
    for (let i = 0; i < n; i++) nums[i].style.height = `${heights[i]}px`; // write
    // show the scrollbar's left border only when the vertical scrollbar exists,
    // aligned to the actual (measured) scrollbar width
    const scrollbarW = this.textarea.offsetWidth - this.textarea.clientWidth;
    const hasScroll = scrollbarW > 0;
    this.codeStack.classList.toggle('has-vscroll', hasScroll);
    if (hasScroll) this.codeStack.style.setProperty('--sbw', `${scrollbarW}px`);
  }

  /**
   * @param {import('./folding.js').FoldLine[]|null} view
   * @param {string} display
   */
  _renderGutter(view, display) {
    // widen the gutter to fit the largest line number (the last line is always visible)
    const maxNum = view && view.length
      ? view[view.length - 1].full + 1
      : (display ? display.split('\n').length : 1);
    const digits = String(maxNum).length;
    if (digits !== this._lastDigits) {
      this._lastDigits = digits;
      this.editorWrap.style.setProperty('--gutter-w', `${Math.max(40, 22 + digits * 9)}px`);
    }

    let html;
    let key;
    if (view) {
      key = 'v:' + view.map((v) => `${v.full}${v.foldable ? (v.folded ? 'c' : 'o') : ''}`).join(',');
      if (key === this._gutterKey) return;
      html = view.map((v) => {
        const fold = v.foldable
          ? `<span class="gln-fold" data-line="${v.full}">${v.folded ? '▸' : '▾'}</span>`
          : '<span class="gln-fold gln-fold--empty"></span>';
        return `<div class="gln">${fold}<span class="gln-num">${v.full + 1}</span></div>`;
      }).join('');
    } else {
      const count = display ? display.split('\n').length : 1;
      key = 'n:' + count;
      if (key === this._gutterKey) return;
      html = '';
      for (let i = 1; i <= count; i++) {
        html += `<div class="gln"><span class="gln-fold gln-fold--empty"></span><span class="gln-num">${i}</span></div>`;
      }
    }
    this._gutterKey = key;
    this.gutter.innerHTML = html;
  }

  _handleInput() {
    this.repaint();
    this.onChange();
  }

  _syncScroll() {
    const pre = this.highlight.parentElement;
    pre.scrollTop = this.textarea.scrollTop;
    pre.scrollLeft = this.textarea.scrollLeft;
    this.gutter.style.transform = `translateY(${-this.textarea.scrollTop}px)`;
  }

  /** Insert two spaces on Tab (ignored while folded/read-only). */
  _handleKeydown(e) {
    if (this.textarea.readOnly || e.key !== 'Tab') return;
    e.preventDefault();
    const { selectionStart: start, selectionEnd: end, value } = this.textarea;
    this.textarea.value = value.slice(0, start) + '  ' + value.slice(end);
    this.textarea.selectionStart = this.textarea.selectionEnd = start + 2;
    this._handleInput();
  }
}
