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
function escapeHtml(src) {
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
