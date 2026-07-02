/**
 * Pan / zoom controller for the diagram canvas.
 *
 * Uses Pointer Events so mouse, touch and pen all work through one code path,
 * with two-finger pinch-to-zoom on touch devices and wheel-zoom on desktop.
 */

import { ZOOM } from './constants.js';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export class Viewport {
  /**
   * @param {HTMLElement} canvas  The pannable container (receives pointer events)
   * @param {SVGSVGElement} svg   The <svg> whose root <g> is transformed
   * @param {{ onScaleChange?: (scale: number) => void }} [options]
   */
  constructor(canvas, svg, { onScaleChange } = {}) {
    this.canvas = canvas;
    this.svg = svg;
    this.onScaleChange = onScaleChange;

    /** @type {SVGGElement|null} */
    this.content = null;
    this.view = { x: 40, y: 60, scale: 1 };

    /** Optional callback fired on any pan/zoom (used to keep overlays aligned). */
    this.onChange = null;

    /** @type {Map<number, {x: number, y: number}>} */
    this.pointers = new Map();
    this.pinchDistance = 0;

    this._bindEvents();
  }

  /** @param {SVGGElement|null} group */
  setContent(group) {
    this.content = group;
    this._apply();
  }

  /** Apply the current transform and notify listeners. */
  _apply() {
    if (this.content) {
      const { x, y, scale } = this.view;
      this.content.setAttribute('transform', `translate(${x},${y}) scale(${scale})`);
    }
    this.onScaleChange?.(this.view.scale);
    this.onChange?.();
  }

  /**
   * Project a point from content (group) coordinates to canvas-relative pixels.
   * @param {number} gx
   * @param {number} gy
   * @returns {{x: number, y: number}}
   */
  project(gx, gy) {
    return { x: this.view.x + gx * this.view.scale, y: this.view.y + gy * this.view.scale };
  }

  /**
   * Zoom by `factor` keeping the point (px, py) — in canvas coordinates — fixed.
   */
  zoomAt(px, py, factor) {
    const next = clamp(this.view.scale * factor, ZOOM.MIN, ZOOM.MAX);
    const ratio = next / this.view.scale;
    this.view.x = px - (px - this.view.x) * ratio;
    this.view.y = py - (py - this.view.y) * ratio;
    this.view.scale = next;
    this._apply();
  }

  /** Zoom by `factor` around the canvas centre (used by the +/- buttons). */
  zoomByCenter(factor) {
    const rect = this.canvas.getBoundingClientRect();
    this.zoomAt(rect.width / 2, rect.height / 2, factor);
  }

  /** Scale and centre the content so it fits within the canvas. */
  fit() {
    if (!this.content) return;
    const box = this.content.getBBox();
    const rect = this.canvas.getBoundingClientRect();
    if (box.width === 0 || rect.width === 0) return;

    const scale = Math.min(
      rect.width / (box.width + ZOOM.FIT_PADDING),
      rect.height / (box.height + ZOOM.FIT_PADDING),
      ZOOM.FIT_MAX,
    );
    this.view.scale = scale;
    this.view.x = (rect.width - box.width * scale) / 2 - box.x * scale;
    this.view.y = (rect.height - box.height * scale) / 2 - box.y * scale + 10;
    this._apply();
  }

  _bindEvents() {
    const canvas = this.canvas;

    canvas.addEventListener('pointerdown', (e) => {
      // Track first so a capture failure never drops the pointer.
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { canvas.setPointerCapture(e.pointerId); } catch { /* capture unsupported — ignore */ }
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      const prev = this.pointers.get(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.pointers.size === 1) {
        this.view.x += e.clientX - prev.x;
        this.view.y += e.clientY - prev.y;
        this._apply();
      } else if (this.pointers.size === 2) {
        this._handlePinch();
      }
    });

    const release = (e) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinchDistance = 0;
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const factor = e.deltaY < 0 ? ZOOM.WHEEL : 1 / ZOOM.WHEEL;
      this.zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor);
    }, { passive: false });
  }

  /** Two-pointer pinch: zoom around the midpoint by the change in finger spread. */
  _handlePinch() {
    const [a, b] = [...this.pointers.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    const rect = this.canvas.getBoundingClientRect();
    const midX = (a.x + b.x) / 2 - rect.left;
    const midY = (a.y + b.y) / 2 - rect.top;

    if (this.pinchDistance > 0) {
      this.zoomAt(midX, midY, distance / this.pinchDistance);
    }
    this.pinchDistance = distance;
  }
}
