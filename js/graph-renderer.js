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
 * Render one node and its subtree into `group`.
 * @param {GraphNode} node
 * @param {SVGGElement} group
 */
function renderNode(node, group) {
  const { RADIUS: r, HEAD_H, ROW_H, PAD_X } = LAYOUT;

  group.appendChild(svgEl('rect', {
    x: node.x, y: node.top, width: node.width, height: node.height, rx: r, class: 'node-rect',
  }));
  group.appendChild(svgEl('path', {
    d: roundedTopPath(node.x, node.top, node.width, HEAD_H, r), class: 'node-head-bg',
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
    text.appendChild(svgEl('tspan', { class: row.cls }, row.value));
    group.appendChild(text);

    if (i > 0) {
      group.appendChild(svgEl('line', {
        x1: node.x, y1: node.top + HEAD_H + i * ROW_H,
        x2: node.x + node.width, y2: node.top + HEAD_H + i * ROW_H, class: 'row-sep',
      }));
    }
    if (row.port) {
      group.appendChild(svgEl('circle', {
        cx: node.x + node.width, cy: node.top + HEAD_H + i * ROW_H + ROW_H / 2, r: 3.5, class: 'port-dot',
      }));
    }
  });

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
    renderNode(child, group);
  });
}

/**
 * Replace the SVG contents with a freshly rendered tree.
 * @param {SVGSVGElement} svg
 * @param {GraphNode} tree
 * @returns {SVGGElement} the root group holding the diagram
 */
export function renderGraph(svg, tree) {
  svg.textContent = '';
  const group = /** @type {SVGGElement} */ (svgEl('g'));
  svg.appendChild(group);
  renderNode(tree, group);
  return group;
}
