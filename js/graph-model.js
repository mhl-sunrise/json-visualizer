/**
 * Transforms parsed JSON into a graph of nodes for the diagram.
 *
 * A node represents one object/array (or the root primitive). Each node has:
 *   - title:    the key that introduced it (or "root {}" / "root []")
 *   - rows:     display rows for primitive members ("key: value")
 *   - children: nested object/array nodes, each linked back via `parentRow`
 */

import { LAYOUT } from './constants.js';

/** @typedef {'object'|'array'|'string'|'number'|'boolean'|'null'} JsonType */

/**
 * @typedef {Object} Row
 * @property {string} key    Property name / array index (empty for a primitive root)
 * @property {string} value  Rendered value text
 * @property {boolean} port   True when the row links to a child node
 * @property {string} cls     Token class for colouring the value
 */

/**
 * @typedef {Object} GraphNode
 * @property {number} id
 * @property {number} depth
 * @property {string} title
 * @property {Row[]} rows
 * @property {GraphNode[]} children
 * @property {Row} [parentRow]  The parent row this node hangs off (set on children)
 */

/**
 * Resolve the JSON type of a value.
 * @param {unknown} value
 * @returns {JsonType}
 */
export function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return /** @type {JsonType} */ (typeof value);
}

/**
 * Render a primitive value to display text plus its token class.
 * @param {unknown} value
 * @returns {{ text: string, cls: string }}
 */
export function formatValue(value) {
  const t = typeOf(value);
  let text;
  if (t === 'string') text = `"${value}"`;
  else if (t === 'null') text = 'null';
  else text = String(value);

  if (text.length > LAYOUT.MAX_VALUE) text = text.slice(0, LAYOUT.MAX_VALUE - 1) + '…';

  const cls =
    t === 'string' ? 'tok-str' :
    t === 'number' ? 'tok-num' :
    t === 'boolean' ? 'tok-bool' : 'tok-null';

  return { text, cls };
}

/**
 * Build the full node graph from parsed JSON data.
 * @param {unknown} data
 * @returns {GraphNode}
 */
export function buildTree(data) {
  let nextId = 0;

  /**
   * @param {unknown} value
   * @param {string} title
   * @param {number} depth
   * @returns {GraphNode}
   */
  const build = (value, title, depth) => {
    /** @type {GraphNode} */
    const node = { id: nextId++, depth, title, rows: [], children: [] };
    const t = typeOf(value);

    if (t === 'object' || t === 'array') {
      const entries = t === 'array'
        ? /** @type {unknown[]} */ (value).map((v, i) => [String(i), v])
        : Object.entries(/** @type {object} */ (value));

      for (const [key, val] of entries) {
        const vt = typeOf(val);
        if (vt === 'object' || vt === 'array') {
          const child = build(val, key, depth + 1);
          const size = vt === 'array'
            ? `[${/** @type {unknown[]} */ (val).length}]`
            : `{${Object.keys(/** @type {object} */ (val)).length}}`;
          /** @type {Row} */
          const row = { key, value: size, port: true, cls: 'tok-head' };
          node.rows.push(row);
          child.parentRow = row;
          node.children.push(child);
        } else {
          const { text, cls } = formatValue(val);
          node.rows.push({ key, value: text, port: false, cls });
        }
      }

      if (node.rows.length === 0) {
        node.rows.push({ key: '', value: t === 'array' ? 'empty []' : 'empty {}', port: false, cls: 'tok-null' });
      }
    } else {
      const { text, cls } = formatValue(value);
      node.rows.push({ key: '', value: text, port: false, cls });
    }

    return node;
  };

  return build(data, typeOf(data) === 'array' ? 'root []' : 'root {}', 0);
}

/**
 * Count every node in the tree (including the root).
 * @param {GraphNode} node
 * @returns {number}
 */
export function countNodes(node) {
  return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
}
