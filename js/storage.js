/**
 * Thin wrappers around localStorage that never throw (private-mode / disabled
 * storage safe). Failures degrade silently to in-memory-less behaviour.
 */

/**
 * @param {string} key
 * @returns {string|null}
 */
export function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * @param {string} key
 * @param {string} value
 */
export function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — ignore */
  }
}
