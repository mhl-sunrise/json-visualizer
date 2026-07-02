import { test } from 'node:test';
import assert from 'node:assert/strict';

import { highlightJSON } from '../js/highlight.js';

test('tokenises each JSON value type with the right class', () => {
  const html = highlightJSON('{"n": 1, "s": "x", "b": true, "z": null}');
  assert.match(html, /<span class="tok-key">"n"<\/span>/);
  assert.match(html, /<span class="tok-num">1<\/span>/);
  assert.match(html, /<span class="tok-str">"x"<\/span>/);
  assert.match(html, /<span class="tok-bool">true<\/span>/);
  assert.match(html, /<span class="tok-null">null<\/span>/);
});

test('distinguishes keys from string values by the trailing colon', () => {
  const html = highlightJSON('{"key": "value"}');
  assert.match(html, /<span class="tok-key">"key"<\/span>/);
  assert.match(html, /<span class="tok-str">"value"<\/span>/);
});

test('escapes HTML so embedded markup cannot inject (XSS safety)', () => {
  const html = highlightJSON('{"x": "<img src=x onerror=alert(1)>"}');
  assert.ok(!html.includes('<img'), 'raw tag must not survive');
  assert.match(html, /&lt;img/);
  assert.match(html, /&gt;/);
});

test('escapes ampersands', () => {
  assert.match(highlightJSON('{"a": "x & y"}'), /x &amp; y/);
});
