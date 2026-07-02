/**
 * Application entry point. Wires the DOM to the diagram engine, editor, theme,
 * viewport, and mobile chrome, and drives the parse → build → layout → render
 * pipeline as the user types.
 */

import { LIMITS, PARSE_DEBOUNCE, SAMPLE, ZOOM } from './constants.js';
import { buildGraph } from './graph-model.js';
import { layout } from './graph-layout.js';
import { renderGraph, coerce } from './graph-renderer.js';
import { Viewport } from './viewport.js';
import { ValueEditor } from './value-editor.js';
import { ThemeManager } from './theme.js';
import { JsonEditor } from './editor.js';
import { initBurgerMenu, initMobileTabs, initResizer, initFullscreen } from './ui-chrome.js';
import { registerServiceWorker } from './pwa.js';

/** @param {string} id */
const byId = (id) => document.getElementById(id);

const dom = {
  svg: /** @type {SVGSVGElement} */ (byId('graph')),
  canvas: byId('canvas'),
  workspace: document.querySelector('.workspace'),
  editorPane: document.querySelector('.pane--editor'),
  status: byId('status'),
  statusText: document.querySelector('.status-text'),
  zoomLabel: byId('zoomLabel'),
  lineCount: byId('lineCount'),
  nodeCount: byId('nodeCount'),
  errorBar: byId('errorBar'),
  emptyState: byId('emptyState'),
};

/* ---- Theme ---- */
const theme = new ThemeManager({ meta: /** @type {HTMLMetaElement} */ (byId('themeColorMeta')) });
theme.init();
byId('themeBtn').addEventListener('click', () => theme.toggle());

/* ---- Viewport ---- */
const viewport = new Viewport(dom.canvas, dom.svg, {
  onScaleChange: (scale) => { dom.zoomLabel.textContent = `${Math.round(scale * 100)}%`; },
});
byId('zoomIn').addEventListener('click', () => viewport.zoomByCenter(ZOOM.STEP));
byId('zoomOut').addEventListener('click', () => viewport.zoomByCenter(1 / ZOOM.STEP));
byId('fit').addEventListener('click', () => viewport.fit());

/* ---- In-place value editor (live) ---- */
const valueEditor = new ValueEditor({
  input: /** @type {HTMLInputElement} */ (byId('valueEditor')),
  viewport,
  // live: resize the node AND sync the JSON text, keeping the input focused.
  // We must not call render() here (it would rebuild the tree and drop the
  // editor's node references) — so the text is patched in place.
  onInput: (text) => {
    const t = valueEditor.target;
    if (!t) return;
    t.row.value = displayValue(t.row.kind, text);
    const result = coerce(t.row.kind, text, t.row.raw);
    valueEditor.markInvalid(!result.ok);
    if (result.ok) writeValueToText(t.keys, result.value); // live-sync the JSON editor
    drawDiagram(false);
  },
  onCommit: (text, fromBlur) => {
    const t = valueEditor.target;
    if (!t) return;
    const result = coerce(t.row.kind, text, t.row.raw);
    if (!result.ok) {
      if (fromBlur) { valueEditor.close(); render(false); } // leaving with invalid → revert
      else valueEditor.markInvalid(true);                   // Enter with invalid → keep editing
      return;
    }
    const { keys, raw } = t;
    valueEditor.close();
    if (result.value !== raw) commitValueEdit(keys, result.value);
    else render(false); // no change → rebuild clean from text
  },
  onCancel: () => { valueEditor.close(); render(false); },
});
// keep the overlay input aligned while panning/zooming
viewport.onChange = () => { if (valueEditor.target) valueEditor.reposition(); };

/** Collect the paths of every node that has children (i.e. is collapsible). */
function collapsiblePaths(node, acc = []) {
  if (node.children.length > 0) acc.push(node.path);
  node.children.forEach((c) => collapsiblePaths(c, acc));
  return acc;
}
byId('collapseAll').addEventListener('click', () => {
  if (!state.tree) return;
  state.collapsed = new Set(collapsiblePaths(state.tree));
  drawDiagram(true);
});
byId('expandAll').addEventListener('click', () => {
  if (!state.tree) return;
  state.collapsed.clear();
  drawDiagram(true);
});

/* ---- Status helpers ---- */
/**
 * @param {boolean} ok
 * @param {string} message
 */
function setStatus(ok, message) {
  dom.statusText.textContent = ok ? 'Valid' : 'Invalid';
  dom.status.className = `status ${ok ? 'status--ok' : 'status--err'}`;
  dom.status.title = message;
}

/** Turn a JSON.parse error into a compact, human message. */
function friendlyError(err) {
  return err.message
    .replace(/^JSON\.parse:\s*/, '')
    .replace(/in JSON at position.*/, '')
    .trim();
}

/* ---- Render pipeline ---- */
let debounceId;

/**
 * Diagram state kept between renders so collapse toggles can re-draw without
 * re-parsing. `collapsed` holds node paths; it persists across edits.
 */
const state = { tree: /** @type {import('./graph-model.js').GraphNode|null} */ (null), collapsed: new Set() };

/**
 * @param {boolean} ok      Valid state (controls red vs neutral styling)
 * @param {string} message
 */
function showNotice(ok, message) {
  dom.errorBar.textContent = message;
  dom.errorBar.classList.toggle('error-bar--warn', ok);
  dom.errorBar.hidden = false;
}
function clearNotice() {
  dom.errorBar.hidden = true;
}

function render(fit) {
  const raw = editor.value;
  dom.lineCount.textContent = `${raw ? raw.split('\n').length : 0} lines`;

  if (!raw.trim()) {
    state.tree = null;
    dom.svg.textContent = '';
    viewport.setContent(null);
    dom.nodeCount.textContent = '0 nodes';
    dom.emptyState.hidden = false;
    clearNotice();
    setStatus(true, 'Empty');
    return;
  }

  if (raw.length > LIMITS.MAX_INPUT) {
    state.tree = null;
    const mb = (LIMITS.MAX_INPUT / 1_000_000).toFixed(0);
    setStatus(false, `Input exceeds ${mb} MB`);
    showNotice(false, `⚠ Input too large to render (over ${mb} MB).`);
    return;
  }

  try {
    const { root, count, truncated } = buildGraph(JSON.parse(raw));
    state.tree = root;
    drawDiagram(fit);

    dom.nodeCount.textContent = `${count} ${count === 1 ? 'node' : 'nodes'}${truncated ? ' (truncated)' : ''}`;
    dom.emptyState.hidden = true;
    setStatus(true, 'Valid');
    if (truncated) {
      showNotice(true, `⚠ Large document — showing the first ${count} nodes.`);
    } else {
      clearNotice();
    }
  } catch (err) {
    state.tree = null;
    const message = friendlyError(err);
    setStatus(false, message);
    showNotice(false, `⚠ ${message}`);
  }
}

/**
 * (Re)draw the current tree applying collapse state. Called both after a parse
 * and on every collapse toggle — the latter re-lays-out and re-renders without
 * re-parsing, and preserves the current pan/zoom.
 * @param {boolean} fit
 */
function drawDiagram(fit) {
  if (!state.tree) return;
  const isCollapsed = (node) => state.collapsed.has(node.path);
  layout(state.tree, isCollapsed);
  const editing = valueEditor.target
    ? { path: valueEditor.target.node.path, rowIndex: valueEditor.target.rowIndex }
    : null;
  viewport.setContent(renderGraph(dom.svg, state.tree, {
    collapsed: state.collapsed,
    onToggle: (path) => {
      if (state.collapsed.has(path)) state.collapsed.delete(path);
      else state.collapsed.add(path);
      drawDiagram(false); // keep viewport where it is
    },
    onCommit: commitValueEdit,   // boolean toggle
    onEditStart,                 // string/number → open live overlay editor
    editing,
  }));
  if (fit) viewport.fit();
  if (valueEditor.target) valueEditor.reposition();
}

/** Display text for a value being live-edited (drives node width). */
function displayValue(kind, text) {
  return kind === 'string' ? `"${text}"` : text;
}

/** Begin editing a value: open the overlay input and re-render to hide the value. */
function onEditStart(node, rowIndex, row, keys, valueSpan) {
  const color = getComputedStyle(valueSpan).fill;
  valueEditor.open(node, rowIndex, row, keys, color);
  drawDiagram(false); // re-render so the underlying value text is hidden
}

/**
 * Persist a value edited in the diagram back into the JSON text (type already
 * coerced by the renderer), then re-render from the single source of truth.
 * @param {string[]} keys  Key path to the value ([] = the root primitive)
 * @param {*} value
 */
/**
 * Patch a value into the JSON editor text (no re-parse/re-render). Used for
 * live sync while editing a value in the diagram.
 * @param {string[]} keys
 * @param {*} value
 */
function writeValueToText(keys, value) {
  try {
    if (keys.length === 0) {
      editor.value = JSON.stringify(value, null, 2);
      return;
    }
    const data = JSON.parse(editor.value);
    let target = data;
    for (let i = 0; i < keys.length - 1; i++) target = target[keys[i]];
    target[keys[keys.length - 1]] = value;
    editor.value = JSON.stringify(data, null, 2);
  } catch {
    /* editor text somehow unparseable — ignore */
  }
}

function commitValueEdit(keys, value) {
  writeValueToText(keys, value);
  render(false); // rebuild from the updated text; collapse + viewport preserved
}

/** Debounced re-render triggered by editor edits. */
function scheduleRender() {
  clearTimeout(debounceId);
  debounceId = setTimeout(() => render(false), PARSE_DEBOUNCE);
}

/* ---- Editor ---- */
const editor = new JsonEditor({
  textarea: /** @type {HTMLTextAreaElement} */ (byId('editor')),
  highlight: byId('highlight'),
  gutter: byId('gutter'),
  onChange: scheduleRender,
});

/* ---- Toolbar actions ---- */
byId('sampleBtn').addEventListener('click', () => {
  editor.value = JSON.stringify(SAMPLE, null, 2);
  render(true);
});
byId('formatBtn').addEventListener('click', () => {
  try {
    editor.value = JSON.stringify(JSON.parse(editor.value), null, 2);
    render(false);
  } catch {
    /* leave invalid text untouched */
  }
});
byId('clearBtn').addEventListener('click', () => {
  editor.value = '';
  state.collapsed.clear();
  editor.focus();
  render(false);
});

/* ---- Mobile chrome ---- */
initBurgerMenu({ burger: byId('burger'), menu: byId('actions') });
initMobileTabs({
  workspace: dom.workspace,
  tabs: document.querySelectorAll('.mtab'),
  // fit after the pane becomes visible (getBBox needs a laid-out, shown element)
  onShow: (pane) => { if (pane === 'graph') requestAnimationFrame(() => viewport.fit()); },
});
initResizer({ divider: byId('divider'), editorPane: dom.editorPane, workspace: dom.workspace });
initFullscreen({ button: byId('fullscreenBtn') });

/* ---- PWA ---- */
registerServiceWorker();

/* ---- Boot ---- */
editor.value = JSON.stringify(SAMPLE, null, 2);
render(true);
