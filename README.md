# JSON Diagram — Editor & Visualizer

A fast, dependency-free JSON editor that renders JSON as an interactive node
diagram. Live syntax highlighting, light/dark themes, full touch support, and an
installable, offline-capable PWA — all in vanilla HTML/CSS/ES modules.

## Features

- **Live diagram** — objects/arrays become connected nodes; primitives render inline.
- **Collapsible nodes** — click the toggle on any parent node to fold/unfold its subtree (great for long lists); collapse state is preserved while you edit.
- **Edit values in the diagram** — click a string/number value to edit it seamlessly in place (no box); the card resizes to fit **live as you type**. Click a boolean to toggle it. Edits are type-strict (a number stays a number, an integer rejects decimals) and write back into the JSON on commit.
- **Syntax-highlighted editor** — keys, strings, numbers, booleans and `null` are colour-coded while you type, with a line-number gutter and code folding (fold arrows collapse blocks; the editor is read-only while folded, so folding can never corrupt the JSON).
- **Pan / zoom** — mouse drag + wheel on desktop, one-finger pan and pinch-to-zoom on touch.
- **Light / dark themes** — persisted, follows OS preference, instant (no animation) toggle.
- **Responsive** — a burger menu and JSON/Diagram tab switcher on small screens.
- **PWA** — installable, works offline (network-first so updates ship immediately).

## Running

No build step. Serve the folder over HTTP (a service worker requires `http(s)`,
not `file://`):

```bash
npx http-server -p 8099 -c-1
```

Then open <http://localhost:8099>.

## Deploying

Serve the folder as static files over **HTTPS** (required for the service
worker / PWA). Security response headers are pre-configured:

- `_headers` — read automatically by **Netlify** and **Cloudflare Pages**
- `vercel.json` — read automatically by **Vercel**

Both set `X-Content-Type-Options: nosniff` and deny framing
(`X-Frame-Options: DENY` + CSP `frame-ancestors 'none'`) to prevent MIME
sniffing and clickjacking. A strict Content-Security-Policy is also applied
in-page via `<meta>` (`connect-src 'self'`), so the app never talks to a third
party. On a host that supports custom headers you may move that CSP from the
`<meta>` tag into a real response header for defence-in-depth.

## Architecture

Plain ES modules, each with a single responsibility:

| Module | Responsibility |
| --- | --- |
| `js/main.js` | Entry point — wires the DOM to every module; runs the parse → build → layout → render pipeline. |
| `js/constants.js` | Central configuration (layout geometry, zoom/limits, storage keys, sample doc). |
| `js/graph-model.js` | Turns parsed JSON into a bounded node graph (`buildGraph`, `countNodes`). |
| `js/graph-layout.js` | Assigns node geometry (depth columns + tidy vertical stacking; skips collapsed subtrees). |
| `js/graph-renderer.js` | Renders the laid-out tree into SVG; type-coercion for edits. |
| `js/viewport.js` | Pan/zoom controller (Pointer Events + pinch, wheel, fit, project). |
| `js/editor.js` | Textarea-over-highlight editor: line-number gutter, folding, wrapping, indent guides. |
| `js/highlight.js` | JSON tokeniser + indent guides (tolerant of invalid input). |
| `js/folding.js` | Bracket-matching + folded-view builder for editor code folding. |
| `js/value-editor.js` | Live, in-place value editing overlay for the diagram. |
| `js/theme.js` | Light/dark theme manager. |
| `js/storage.js` | Safe `localStorage` wrappers. |
| `js/ui-chrome.js` | Burger menu, mobile tabs, full-screen, draggable sidebar divider. |
| `js/pwa.js` | Service worker registration. |
| `sw.js` | Offline cache (network-first for app assets). |

### Data flow

```
textarea input
  → JsonEditor.onChange (debounced)
    → JSON.parse → buildGraph → layout → renderGraph
      → Viewport.setContent (applies pan/zoom transform)
```

## Testing

Pure logic (model, layout, highlighting, folding) is unit-tested with Node's
built-in runner — no dependencies:

```bash
npm test    # node --test
```

## Browser support

Modern evergreen browsers (ES modules, Pointer Events, `ResizeObserver`,
`color-mix()`, CSS custom properties).
