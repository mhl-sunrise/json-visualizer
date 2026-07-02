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
  assert.equal(root.title, 'root');
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

test('buildGraph assigns stable, hierarchical paths for collapse tracking', () => {
  const { root } = buildGraph({ a: { b: { c: 1 } }, list: [{ x: 1 }] });
  assert.equal(root.path, '$');
  const a = root.children.find((c) => c.title === 'a');
  assert.equal(a.path, '$/a');
  assert.equal(a.children[0].path, '$/a/b');
  const list = root.children.find((c) => c.title === 'list');
  assert.equal(list.children[0].path, '$/list/0');
});

test('primitive rows carry kind + raw for editing; null and ports do not', () => {
  const { root } = buildGraph({ s: 'x', n: 3, b: true, z: null, child: { a: 1 } });
  const rowFor = (k) => root.rows.find((r) => r.key === k);

  assert.deepEqual({ kind: rowFor('s').kind, raw: rowFor('s').raw }, { kind: 'string', raw: 'x' });
  assert.deepEqual({ kind: rowFor('n').kind, raw: rowFor('n').raw }, { kind: 'number', raw: 3 });
  assert.deepEqual({ kind: rowFor('b').kind, raw: rowFor('b').raw }, { kind: 'boolean', raw: true });
  assert.equal(rowFor('z').kind, undefined);          // null is not editable
  assert.equal(rowFor('child').port, true);           // object row is a port
  assert.equal(rowFor('child').kind, undefined);      // ports are not editable
});

test('nodes carry the key path to their data', () => {
  const { root } = buildGraph({ a: { b: 1 }, list: [{ x: 1 }] });
  assert.deepEqual(root.keys, []);
  assert.deepEqual(root.children.find((c) => c.title === 'a').keys, ['a']);
  assert.deepEqual(root.children.find((c) => c.title === 'list').children[0].keys, ['list', '0']);
});

test('buildGraph labels the root and empty containers', () => {
  assert.equal(buildGraph([]).root.title, 'root');
  assert.equal(buildGraph({}).root.title, 'root');
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
