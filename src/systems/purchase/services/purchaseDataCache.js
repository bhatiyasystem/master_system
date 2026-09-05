/**
 * Module-level data cache for Purchase views.
 *
 * Because each purchase page is a separate React-Router route, components
 * unmount when you navigate away. useRef / useState resets on remount, so
 * the spinner appeared every time the user re-visited a page.
 *
 * This cache lives outside React's lifecycle. Each view stores its last
 * successful fetch result here and reads it back on remount — giving an
 * instant render from cache while a fresh network fetch runs silently in
 * the background.
 */

const cache = {};

export function getCached(key) {
  return cache[key] ?? null;
}

export function setCached(key, value) {
  cache[key] = value;
}
