/**
 * Application entry point. Wires the DOM to the diagram engine, editor, theme,
 * viewport, and mobile chrome, and drives the parse → build → layout → render
 * pipeline as the user types.
 */

import { LIMITS, PARSE_DEBOUNCE, SAMPLE, ZOOM } from './constants.js';
import { buildGraph } from './graph-model.js';
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
    dom.svg.textContent = '';
    viewport.setContent(null);
    dom.nodeCount.textContent = '0 nodes';
    dom.emptyState.hidden = false;
    clearNotice();
    setStatus(true, 'Empty');
    return;
  }

  if (raw.length > LIMITS.MAX_INPUT) {
    const mb = (LIMITS.MAX_INPUT / 1_000_000).toFixed(0);
    setStatus(false, `Input exceeds ${mb} MB`);
    showNotice(false, `⚠ Input too large to render (over ${mb} MB).`);
    return;
  }

  try {
    const { root, count, truncated } = buildGraph(JSON.parse(raw));
    layout(root);
    viewport.setContent(renderGraph(dom.svg, root));

    dom.nodeCount.textContent = `${count} ${count === 1 ? 'node' : 'nodes'}${truncated ? ' (truncated)' : ''}`;
    dom.emptyState.hidden = true;
    setStatus(true, 'Valid');
    if (truncated) {
      showNotice(true, `⚠ Large document — showing the first ${count} nodes.`);
    } else {
      clearNotice();
    }
    if (fit) viewport.fit();
  } catch (err) {
    const message = friendlyError(err);
    setStatus(false, message);
    showNotice(false, `⚠ ${message}`);
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
