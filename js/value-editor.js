/**
 * In-place value editor for the diagram.
 *
 * The editable field is a single HTML <input> that floats over the canvas
 * (NOT a foreignObject inside the SVG). Because it lives outside the SVG, the
 * diagram can re-render on every keystroke — for live resizing — without ever
 * destroying the input, so focus and caret are preserved.
 */

import { LAYOUT } from './constants.js';

export class ValueEditor {
  /**
   * @param {{
   *   input: HTMLInputElement,
   *   viewport: import('./viewport.js').Viewport,
   *   onInput: (text: string) => void,
   *   onCommit: (text: string, fromBlur: boolean) => void,
   *   onCancel: () => void,
   * }} refs
   */
  constructor({ input, viewport, onInput, onCommit, onCancel }) {
    this.input = input;
    this.viewport = viewport;
    this.onInput = onInput;
    this.onCommit = onCommit;
    this.onCancel = onCancel;
    /** @type {{node: any, rowIndex: number, row: any, keys: string[]}|null} */
    this.target = null;

    input.addEventListener('pointerdown', (e) => e.stopPropagation());
    input.addEventListener('input', () => { if (this.target) this.onInput(this.input.value); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); if (this.target) this.onCommit(this.input.value, false); }
      else if (e.key === 'Escape') { e.preventDefault(); if (this.target) this.onCancel(); }
    });
    input.addEventListener('blur', () => { if (this.target) this.onCommit(this.input.value, true); });
  }

  /**
   * Begin editing a value.
   * @param {any} node
   * @param {number} rowIndex
   * @param {any} row
   * @param {string[]} keys
   * @param {string} color  CSS colour of the value token
   */
  open(node, rowIndex, row, keys, color) {
    this.target = { node, rowIndex, row, keys };
    this.input.value = String(row.raw);
    this.input.style.color = color;
    this.input.classList.remove('invalid');
    this.input.hidden = false;
    this.reposition();
    this.input.focus();
    this.input.select();
  }

  /** Position/size the input over the value, following pan/zoom and live resize. */
  reposition() {
    const t = this.target;
    if (!t) return;
    const { node, rowIndex, row } = t;
    const { PAD_X, HEAD_H, ROW_H, CHAR_W } = LAYOUT;
    const height = ROW_H - 6;
    const keyWidth = row.key ? (row.key.length + 2) * CHAR_W : 0;
    const gx = node.x + PAD_X + keyWidth;                              // value left (group coords)
    // vertically centre the input box on the row (row centre = rowTop + ROW_H/2)
    const gy = node.top + HEAD_H + rowIndex * ROW_H + (ROW_H - height) / 2;
    const scale = this.viewport.view.scale;
    const { x, y } = this.viewport.project(gx, gy);
    const s = this.input.style;
    s.left = `${x}px`;
    s.top = `${y}px`;
    s.height = `${height * scale}px`;
    s.width = `${Math.max(20, node.x + node.width - PAD_X - gx) * scale}px`;
    s.fontSize = `${12 * scale}px`;
  }

  /** @param {boolean} invalid */
  markInvalid(invalid) {
    this.input.classList.toggle('invalid', invalid);
  }

  close() {
    this.input.hidden = true;
    this.input.classList.remove('invalid');
    this.target = null;
  }
}
