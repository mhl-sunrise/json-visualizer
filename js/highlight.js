/**
 * Lightweight JSON syntax highlighter for the editor overlay.
 *
 * Works on partial / invalid input (it tokenises, it does not parse), so the
 * colours stay live while the user is mid-edit.
 */

/**
 * Escape the three HTML-significant characters. Quotes are intentionally left
 * intact so the tokeniser regex can still match JSON strings.
 * @param {string} src
 */
export function escapeHtml(src) {
  return src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const TOKEN =
  /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

/**
 * Produce highlighted HTML for a block of (possibly invalid) JSON text.
 * @param {string} src
 * @returns {string}
 */
export function highlightJSON(src) {
  return escapeHtml(src).replace(TOKEN, (match, str, colon, bool) => {
    if (str) {
      const cls = colon ? 'tok-key' : 'tok-str';
      return `<span class="${cls}">${str}</span>` + (colon || '');
    }
    if (bool) return `<span class="tok-bool">${match}</span>`;
    if (match === 'null') return `<span class="tok-null">${match}</span>`;
    return `<span class="tok-num">${match}</span>`;
  });
}

/**
 * Wrap each two-space indent level of every line in a marker span, so the CSS
 * can draw a vertical indentation guide (VS Code style) inside the leading
 * whitespace only. Operates on already-highlighted HTML; width is unchanged so
 * the transparent textarea stays perfectly aligned.
 * @param {string} html  output of highlightJSON
 * @returns {string}
 */
export function addIndentGuides(html) {
  return html.split('\n').map((line) => {
    const m = /^( +)/.exec(line);
    if (!m) return line;
    const spaces = m[1];
    const units = spaces.length >> 1; // one guide per 2-space level
    if (units === 0) return line;
    const guides = '<span class="ind">  </span>'.repeat(units);
    return guides + spaces.slice(units * 2) + line.slice(spaces.length);
  }).join('\n');
}
