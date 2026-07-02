import { test } from 'node:test';
import assert from 'node:assert/strict';

import { typeOf, formatValue, buildGraph, countNodes } from '../js/graph-model.js';
import { LAYOUT } from '../js/constants.js';

test('typeOf classifies JSON values', () => {
  assert.equal(typeOf(null), 'null');
  assert.equal(typeOf([]), 'array');
  assert.equal(typeOf({}), 'object');
  assert.equal(typeOf('x'), 'string');
  assert.equal(typeOf(1), 'number');
  assert.equal(typeOf(true), 'boolean');
});

test('formatValue quotes strings, labels null, and truncates', () => {
  assert.deepEqual(formatValue('hi'), { text: '"hi"', cls: 'tok-str' });
  assert.deepEqual(formatValue(42), { text: '42', cls: 'tok-num' });
  assert.deepEqual(formatValue(false), { text: 'false', cls: 'tok-bool' });
  assert.deepEqual(formatValue(null), { text: 'null', cls: 'tok-null' });

  const long = formatValue('x'.repeat(200));
  assert.ok(long.text.length <= LAYOUT.MAX_VALUE);
  assert.ok(long.text.endsWith('…'));
});

test('buildGraph builds root, rows, and child links', () => {
  const { root, count, truncated } = buildGraph({ name: 'a', nested: { x: 1 }, list: [1, 2] });
  assert.equal(truncated, false);
  assert.equal(root.title, 'root {}');
  assert.equal(count, countNodes(root));

  // primitive row
  const nameRow = root.rows.find((r) => r.key === 'name');
  assert.deepEqual({ v: nameRow.value, port: nameRow.port }, { v: '"a"', port: false });

  // object/array become children with a port row linking back
  assert.equal(root.children.length, 2);
  for (const child of root.children) {
    assert.equal(child.parentRow.port, true);
    assert.ok(root.rows.includes(child.parentRow));
  }
});

test('buildGraph labels an array root and empty containers', () => {
  assert.equal(buildGraph([]).root.title, 'root []');
  assert.equal(buildGraph({}).root.rows[0].value, 'empty {}');
  assert.equal(buildGraph([]).root.rows[0].value, 'empty []');
});

test('buildGraph truncates when the node budget is exceeded', () => {
  const wide = {};
  for (let i = 0; i < 50; i++) wide['k' + i] = { nested: true };
  const { count, truncated } = buildGraph(wide, { maxNodes: 5 });
  assert.equal(truncated, true);
  assert.ok(count <= 5, `count ${count} should be <= 5`);
});

test('buildGraph stops at the depth limit with a placeholder', () => {
  const deep = { a: { a: { a: { a: { a: 1 } } } } };
  const { root, truncated } = buildGraph(deep, { maxDepth: 2 });
  assert.equal(truncated, true);

  // walk to depth 2 — it must be a placeholder leaf, not recurse further
  let node = root;                 // depth 0
  node = node.children[0];         // depth 1
  node = node.children[0];         // depth 2
  assert.equal(node.children.length, 0);
  assert.equal(node.rows[0].value, '…');
});
