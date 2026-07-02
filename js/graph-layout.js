/**
 * Assigns geometry (x, top, width, height) to every node in the graph.
 *
 * Nodes are placed in depth-based columns; siblings are stacked vertically and
 * each parent is centred on the vertical span of its children.
 */

import { LAYOUT } from './constants.js';

/** @typedef {import('./graph-model.js').GraphNode} GraphNode */

/**
 * Measure a node (and its subtree) to set `width` and `height`.
 * @param {GraphNode} node
 */
function measure(node) {
  let maxLen = node.title.length + 2;
  for (const row of node.rows) {
    const len = (row.key ? row.key.length + 2 : 0) + row.value.length;
    if (len > maxLen) maxLen = len;
  }
  node.width = Math.max(LAYOUT.MIN_WIDTH, Math.round(maxLen * LAYOUT.CHAR_W + LAYOUT.PAD_X * 2));
  node.height = LAYOUT.HEAD_H + node.rows.length * LAYOUT.ROW_H;
  node.children.forEach(measure);
}

/**
 * Group nodes by depth.
 * @param {GraphNode} node
 * @param {Record<number, GraphNode[]>} map
 */
function collectByDepth(node, map) {
  (map[node.depth] ||= []).push(node);
  node.children.forEach((child) => collectByDepth(child, map));
}

/**
 * Lay out the tree in place. Mutates each node with x/top/width/height.
 * @param {GraphNode} root
 * @returns {GraphNode} the same root, for chaining
 */
export function layout(root) {
  measure(root);

  // Column x-offsets from the widest node at each depth.
  /** @type {Record<number, GraphNode[]>} */
  const byDepth = {};
  collectByDepth(root, byDepth);

  /** @type {Record<number, number>} */
  const columnX = {};
  let x = 0;
  for (const depth of Object.keys(byDepth).map(Number).sort((a, b) => a - b)) {
    columnX[depth] = x;
    const widest = Math.max(...byDepth[depth].map((n) => n.width));
    x += widest + LAYOUT.COL_GAP;
  }

  // Vertical placement: stack leaves, centre parents on their children.
  let cursorY = 0;
  const place = (node) => {
    node.x = columnX[node.depth];
    if (node.children.length === 0) {
      node.top = cursorY;
      cursorY += node.height + LAYOUT.V_GAP;
    } else {
      node.children.forEach(place);
      const first = node.children[0];
      const last = node.children[node.children.length - 1];
      const mid = (first.top + first.height / 2 + last.top + last.height / 2) / 2;
      node.top = mid - node.height / 2;
    }
  };
  place(root);

  return root;
}
