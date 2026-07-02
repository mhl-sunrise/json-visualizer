import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeFolds, buildFoldView } from '../js/folding.js';

const DOC = [
  '{',              // 0
  '  "a": 1,',      // 1
  '  "obj": {',     // 2  -> closes at 4
  '    "b": 2',     // 3
  '  },',           // 4
  '  "arr": [',     // 5  -> closes at 8
  '    1,',         // 6
  '    2',          // 7
  '  ]',            // 8
  '}',              // 9 (closes 0)
].join('\n');

test('computeFolds maps opening lines to their closing lines', () => {
  const folds = computeFolds(DOC);
  assert.equal(folds.get(0), 9);
  assert.equal(folds.get(2), 4);
  assert.equal(folds.get(5), 8);
  assert.equal(folds.has(1), false); // primitive line, not foldable
});

test('brackets inside strings are ignored', () => {
  const folds = computeFolds('{\n  "x": "a { b [ c"\n}');
  assert.equal(folds.get(0), 2);
  assert.equal(folds.size, 1);
});

test('buildFoldView with no folds returns every line unchanged', () => {
  const view = buildFoldView(DOC, new Set());
  assert.equal(view.length, 10);
  assert.equal(view[0].foldable, true);
  assert.equal(view[1].foldable, false);
  assert.equal(view.map((v) => v.text).join('\n'), DOC);
});

test('folding a block collapses it to one placeholder line and skips the rest', () => {
  const view = buildFoldView(DOC, new Set([2])); // fold "obj"
  const texts = view.map((v) => v.text);
  assert.ok(texts.some((t) => t.includes('"obj": { … }')), 'placeholder present');
  // lines 3 and 4 are hidden; next visible full index after obj is 5
  const fullIndices = view.map((v) => v.full);
  assert.ok(!fullIndices.includes(3));
  assert.ok(!fullIndices.includes(4));
  assert.ok(fullIndices.includes(5));
});
