/**
 * Renders a laid-out node graph into an <svg> element and returns the root
 * <g> so the viewport can apply pan/zoom transforms to it.
 */

import { LAYOUT } from './constants.js';

/** @typedef {import('./graph-model.js').GraphNode} GraphNode */

const SVGNS = 'http://www.w3.org/2000/svg';

/**
 * Create an SVG element with attributes and optional text content.
 * @param {string} name
 * @param {Record<string, string|number>} [attrs]
 * @param {string} [text]
 * @returns {SVGElement}
 */
function svgEl(name, attrs = {}, text) {
  const el = document.createElementNS(SVGNS, name);
  for (const key in attrs) el.setAttribute(key, String(attrs[key]));
  if (text != null) el.textContent = text;
  return el;
}

/**
 * Centre-y of a given row within a node.
 * @param {GraphNode} node
 * @param {number} index
 */
function rowCenterY(node, index) {
  return node.top + LAYOUT.HEAD_H + index * LAYOUT.ROW_H + LAYOUT.ROW_H / 2;
}

/** Path for a rectangle rounded only on its top two corners (node header). */
function roundedTopPath(x, y, w, h, r) {
  return `M${x},${y + h} v${-(h - r)} a${r},${r} 0 0 1 ${r},${-r} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} z`;
}

/**
 * Coerce edited text to the row's original type. Returns `{ ok, value }`.
 * `number` stays a number (and stays an integer if the original was one).
 * @param {'string'|'number'|'boolean'} kind
 * @param {string} text
 * @param {*} original
 */
export function coerce(kind, text, original) {
  if (kind === 'string') return { ok: true, value: text };
  if (kind === 'number') {
    const trimmed = text.trim();
    const n = Number(trimmed);
    if (trimmed === '' || !Number.isFinite(n)) return { ok: false };
    if (Number.isInteger(original) && !Number.isInteger(n)) return { ok: false };
    return { ok: true, value: n };
  }
  // boolean
  const t = text.trim().toLowerCase();
  if (t === 'true') return { ok: true, value: true };
  if (t === 'false') return { ok: true, value: false };
  return { ok: false };
}

/**
 * Draw the collapse/expand toggle in a node's header.
 * @param {GraphNode} node
 * @param {boolean} collapsed
 * @param {RenderContext} ctx
 */
function renderToggle(node, collapsed, ctx) {
  const { HEAD_H } = LAYOUT;
  const cx = node.x + node.width - 15;
  const cy = node.top + HEAD_H / 2;

  const g = svgEl('g', { class: 'node-toggle', tabindex: '0', role: 'button' });
  g.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} ${node.title}`);
  // large transparent disc = generous clickable / pointer-cursor hit area
  g.appendChild(svgEl('circle', { cx, cy, r: 13, class: 'toggle-bg' }));
  g.appendChild(svgEl('line', { x1: cx - 4, y1: cy, x2: cx + 4, y2: cy, class: 'toggle-icon' }));
  if (collapsed) {
    g.appendChild(svgEl('line', { x1: cx, y1: cy - 4, x2: cx, y2: cy + 4, class: 'toggle-icon' }));
  }

  const fire = (e) => { e.stopPropagation(); ctx.onToggle?.(node.path); };
  // stop pointerdown so the viewport doesn't start a pan/capture on this click
  g.addEventListener('pointerdown', (e) => e.stopPropagation());
  g.addEventListener('click', fire);
  g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fire(e); });
  ctx.group.appendChild(g);
}

/**
 * Render one node and its visible subtree.
 * @param {GraphNode} node
 * @param {RenderContext} ctx
 */
function renderNode(node, ctx) {
  const group = ctx.group;
  const { RADIUS: r, HEAD_H, ROW_H, PAD_X } = LAYOUT;
  const collapsed = ctx.collapsed.has(node.path);

  // Background fill, then header fill, then the border ON TOP so the header
  // fill can't paint over the inner half of the stroke (which looked doubled).
  group.appendChild(svgEl('rect', {
    x: node.x, y: node.top, width: node.width, height: node.height, rx: r, class: 'node-rect',
  }));
  group.appendChild(svgEl('path', {
    d: roundedTopPath(node.x, node.top, node.width, HEAD_H, r), class: 'node-head-bg',
  }));
  group.appendChild(svgEl('rect', {
    x: node.x, y: node.top, width: node.width, height: node.height, rx: r, class: 'node-border',
  }));
  group.appendChild(svgEl('line', {
    x1: node.x, y1: node.top + HEAD_H, x2: node.x + node.width, y2: node.top + HEAD_H, class: 'row-sep',
  }));
  group.appendChild(svgEl('text', {
    x: node.x + PAD_X, y: node.top + HEAD_H / 2 + 4, class: 'mono node-title',
  }, node.title));

  node.rows.forEach((row, i) => {
    const y = node.top + HEAD_H + i * ROW_H + ROW_H / 2 + 4;
    const text = svgEl('text', { x: node.x + PAD_X, y, class: 'mono' });
    if (row.key !== '') {
      text.appendChild(svgEl('tspan', { class: 'tok-key' }, row.key));
      text.appendChild(svgEl('tspan', { class: 'tok-punct' }, ': '));
    }
    const valueSpan = svgEl('tspan', { class: row.cls }, row.value);
    // Editable primitive values (string/number/boolean) become click-to-edit.
    if (row.kind && (ctx.onEditStart || ctx.onCommit)) {
      const keys = row.key === '' ? node.keys : [...node.keys, row.key];
      valueSpan.setAttribute('class', `${row.cls} editable editable--${row.kind}`);
      valueSpan.addEventListener('pointerdown', (e) => e.stopPropagation());
      valueSpan.addEventListener('click', (e) => {
        e.stopPropagation();
        if (row.kind === 'boolean') ctx.onCommit(keys, !row.raw);
        else ctx.onEditStart?.(node, i, row, keys, valueSpan);
      });
      // hide the value text of the row currently being edited (overlay covers it)
      if (ctx.editing && ctx.editing.path === node.path && ctx.editing.rowIndex === i) {
        valueSpan.setAttribute('visibility', 'hidden');
      }
    }
    text.appendChild(valueSpan);
    group.appendChild(text);

    if (i > 0) {
      group.appendChild(svgEl('line', {
        x1: node.x, y1: node.top + HEAD_H + i * ROW_H,
        x2: node.x + node.width, y2: node.top + HEAD_H + i * ROW_H, class: 'row-sep',
      }));
    }
    if (row.port) {
      const size = 8;
      const cx = node.x + node.width;
      const cy = node.top + HEAD_H + i * ROW_H + ROW_H / 2;
      group.appendChild(svgEl('rect', {
        x: cx - size / 2, y: cy - size / 2, width: size, height: size, rx: 3,
        class: collapsed ? 'port-dot port-dot--collapsed' : 'port-dot',
      }));
    }
  });

  // A parent node gets a collapse toggle; its children/edges render only when open.
  if (node.children.length > 0) {
    renderToggle(node, collapsed, ctx);
    if (!collapsed) {
      node.children.forEach((child) => {
        const rowIndex = node.rows.indexOf(child.parentRow);
        const px = node.x + node.width;
        const py = rowCenterY(node, rowIndex);
        const cx = child.x;
        const cy = child.top + child.height / 2;
        const dx = Math.max(30, (cx - px) / 2);
        // edges drawn behind nodes
        group.insertBefore(svgEl('path', {
          d: `M${px},${py} C${px + dx},${py} ${cx - dx},${cy} ${cx},${cy}`, class: 'edge',
        }), group.firstChild);
        renderNode(child, ctx);
      });
    }
  }
}

/**
 * @typedef {Object} RenderContext
 * @property {SVGGElement} group
 * @property {Set<string>} collapsed        Paths of collapsed nodes
 * @property {(path: string) => void} [onToggle]
 * @property {(keys: string[], value: *) => void} [onCommit]  Toggle a boolean value
 * @property {(node: any, rowIndex: number, row: any, keys: string[], valueSpan: SVGElement) => void} [onEditStart]
 * @property {{path: string, rowIndex: number}|null} [editing]  Row currently being edited
 */

/**
 * Replace the SVG contents with a freshly rendered tree.
 * @param {SVGSVGElement} svg
 * @param {GraphNode} tree
 * @param {object} [options]
 * @returns {SVGGElement} the root group holding the diagram
 */
export function renderGraph(svg, tree, { collapsed = new Set(), onToggle, onCommit, onEditStart, editing = null } = {}) {
  svg.textContent = '';
  const group = /** @type {SVGGElement} */ (svgEl('g'));
  svg.appendChild(group);
  renderNode(tree, { group, collapsed, onToggle, onCommit, onEditStart, editing });
  return group;
}
