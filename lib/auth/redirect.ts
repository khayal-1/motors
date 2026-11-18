const INTERNAL_ORIGIN = 'https://internal.invalid';
const AUTH_PATH_PREFIX = '/auth/';

/** Accept only same-origin paths, and never send users back into an auth loop. */
export function safeNextPath(candidate: unknown, fallback = '/admin'): string {
  if (typeof candidate !== 'string' || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return fallback;
  }
  if (/[\\\u0000-\u001f\u007f]/.test(candidate)) return fallback;

  try {
    const destination = new URL(candidate, INTERNAL_ORIGIN);
    if (destination.origin !== INTERNAL_ORIGIN || destination.pathname.startsWith(AUTH_PATH_PREFIX)) {
      return fallback;
    }
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}
