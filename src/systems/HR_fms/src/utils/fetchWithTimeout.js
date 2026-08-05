// Drop-in replacement for fetch(). Same signature, same return value
// (a normal Response), same error-throwing behavior — so any existing
// .then()/.catch()/try-catch code that calls fetch() works unchanged.
//
// The only difference: if the request takes longer than `timeoutMs`,
// it aborts and throws an error (which existing catch blocks already
// handle) instead of hanging forever.
//
// Usage: replace `fetch(url, options)` with `fetchWithTimeout(url, options)`
// Optional 3rd arg to override the default timeout: fetchWithTimeout(url, options, 5000)

export async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}