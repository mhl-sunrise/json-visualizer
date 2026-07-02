/**
 * Application entry point. Wires the DOM to the diagram engine, editor, theme,
 * viewport, and mobile chrome, and drives the parse → build → layout → render
 * pipeline as the user types.
 */

import { PARSE_DEBOUNCE, SAMPLE, ZOOM } from './constants.js';
import { buildTree, countNodes } from './graph-model.js';
import { layout } from './graph-layout.js';
import { renderGraph } from './graph-renderer.js';
import { Viewport } from './viewport.js';
import { ThemeManager } from './theme.js';
import { JsonEditor } from './editor.js';
import { initBurgerMenu, initMobileTabs, initResizer } from './ui-chrome.js';
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

function render(fit) {
  const raw = editor.value;
  dom.lineCount.textContent = `${raw ? raw.split('\n').length : 0} lines`;

  if (!raw.trim()) {
    dom.svg.textContent = '';
    viewport.setContent(null);
    dom.nodeCount.textContent = '0 nodes';
    dom.emptyState.hidden = false;
    dom.errorBar.hidden = true;
    setStatus(true, 'Empty');
    return;
  }

  try {
    const tree = layout(buildTree(JSON.parse(raw)));
    viewport.setContent(renderGraph(dom.svg, tree));

    const count = countNodes(tree);
    dom.nodeCount.textContent = `${count} ${count === 1 ? 'node' : 'nodes'}`;
    dom.emptyState.hidden = true;
    dom.errorBar.hidden = true;
    setStatus(true, 'Valid');
    if (fit) viewport.fit();
  } catch (err) {
    const message = friendlyError(err);
    setStatus(false, message);
    dom.errorBar.textContent = `⚠ ${message}`;
    dom.errorBar.hidden = false;
  }
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

/* ---- PWA ---- */
registerServiceWorker();

/* ---- Boot ---- */
editor.value = JSON.stringify(SAMPLE, null, 2);
render(true);
