/**
 * Code-folding helpers for the editor gutter. Pure and tolerant of invalid
 * input — a string-aware brace scan, so it never throws on partial JSON.
 */

/**
 * Map each multi-line block's opening line index to its closing line index.
 * Single-line blocks (open and close on the same line) are not foldable.
 * @param {string} text
 * @returns {Map<number, number>}
 */
export function computeFolds(text) {
  /** @type {Map<number, number>} */
  const folds = new Map();
  /** @type {number[]} */
  const stack = [];
  let line = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '\n') line++;
    else if (c === '{' || c === '[') stack.push(line);
    else if (c === '}' || c === ']') {
      const open = stack.pop();
      if (open !== undefined && open !== line && !folds.has(open)) folds.set(open, line);
    }
  }
  return folds;
}

/**
 * @typedef {Object} FoldLine
 * @property {number} full      0-based line index in the source text
 * @property {boolean} foldable Line opens a multi-line block
 * @property {boolean} folded   That block is currently folded
 * @property {string} text      Display text (a one-line placeholder when folded)
 */

/**
 * Produce the visible lines for a (possibly) folded view.
 * @param {string} text
 * @param {Set<number>} folded  Set of folded opening-line indices
 * @returns {FoldLine[]}
 */
export function buildFoldView(text, folded) {
  const lines = text.split('\n');
  const folds = computeFolds(text);
  /** @type {FoldLine[]} */
  const view = [];

  let i = 0;
  while (i < lines.length) {
    const foldable = folds.has(i);
    const isFolded = foldable && folded.has(i);
    let display = lines[i];
    if (isFolded) {
      const close = folds.get(i);
      display = `${lines[i].replace(/\s+$/, '')} … ${lines[close].replace(/^\s+/, '')}`;
    }
    view.push({ full: i, foldable, folded: isFolded, text: display });
    i = isFolded ? folds.get(i) + 1 : i + 1;
  }
  return view;
}
