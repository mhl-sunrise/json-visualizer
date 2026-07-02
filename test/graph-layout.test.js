import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildGraph } from '../js/graph-model.js';
import { layout } from '../js/graph-layout.js';
import { LAYOUT } from '../js/constants.js';

/** Collect every node in the tree. */
function flatten(node, acc = []) {
  acc.push(node);
  node.children.forEach((c) => flatten(c, acc));
  return acc;
}

test('layout assigns finite geometry to every node', () => {
  const { root } = buildGraph({ a: 1, b: { c: 2 }, d: [1, 2, 3] });
  layout(root);

  for (const node of flatten(root)) {
    for (const prop of ['x', 'top', 'width', 'height']) {
      assert.equal(typeof node[prop], 'number', `${prop} should be a number`);
      assert.ok(Number.isFinite(node[prop]), `${prop} should be finite`);
    }
    assert.ok(node.width >= LAYOUT.MIN_WIDTH);
    assert.ok(node.height >= LAYOUT.HEAD_H);
  }
});

test('deeper nodes are placed in later (rightward) columns', () => {
  const { root } = buildGraph({ child: { grandchild: { x: 1 } } });
  layout(root);

  const child = root.children[0];
  const grandchild = child.children[0];
  assert.ok(child.x > root.x, 'child right of root');
  assert.ok(grandchild.x > child.x, 'grandchild right of child');
});

test('layout returns the same root for chaining', () => {
  const { root } = buildGraph({ a: 1 });
  assert.equal(layout(root), root);
});
