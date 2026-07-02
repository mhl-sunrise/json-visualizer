/**
 * Progressive Web App registration.
 */

import { SW_PATH } from './constants.js';

/** Register the service worker once the page has loaded. No-op if unsupported. */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(SW_PATH).catch(() => {
      /* offline support unavailable — non-fatal */
    });
  });
}
