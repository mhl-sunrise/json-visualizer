# JSON Diagram — Editor & Visualizer

A fast, dependency-free JSON editor that renders JSON as an interactive node
diagram. Live syntax highlighting, light/dark themes, full touch support, and an
installable, offline-capable PWA — all in vanilla HTML/CSS/ES modules.

## Features

- **Live diagram** — objects/arrays become connected nodes; primitives render inline.
- **Syntax-highlighted editor** — keys, strings, numbers, booleans and `null` are colour-coded while you type.
- **Pan / zoom** — mouse drag + wheel on desktop, one-finger pan and pinch-to-zoom on touch.
- **Light / dark themes** — persisted, follows OS preference, instant (no animation) toggle.
- **Responsive** — a burger menu and JSON/Diagram tab switcher on small screens.
- **PWA** — installable, works offline (network-first so updates ship immediately).

## Running

No build step. Serve the folder over HTTP (a service worker requires `http(s)`,
not `file://`):

```bash
npx http-server simple-editor -p 8099 -c-1
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
| `js/constants.js` | Central configuration (layout geometry, zoom limits, storage keys, sample doc). |
| `js/graph-model.js` | Turns parsed JSON into a node graph (`buildTree`, `countNodes`). |
| `js/graph-layout.js` | Assigns node geometry (depth columns + tidy vertical stacking). |
| `js/graph-renderer.js` | Renders the laid-out tree into SVG. |
| `js/viewport.js` | Pan/zoom controller (Pointer Events + pinch, wheel, fit). |
| `js/editor.js` | Transparent-textarea-over-highlight editor component. |
| `js/highlight.js` | JSON tokeniser for editor highlighting (tolerant of invalid input). |
| `js/theme.js` | Light/dark theme manager. |
| `js/storage.js` | Safe `localStorage` wrappers. |
| `js/ui-chrome.js` | Burger menu, mobile tabs, draggable sidebar divider. |
| `js/pwa.js` | Service worker registration. |
| `sw.js` | Offline cache (network-first for app assets). |

### Data flow

```
textarea input
  → JsonEditor.onChange (debounced)
    → JSON.parse → buildTree → layout → renderGraph
      → Viewport.setContent (applies pan/zoom transform)
```

## Browser support

Modern evergreen browsers (ES modules, Pointer Events, `color-mix()`,
CSS custom properties).
