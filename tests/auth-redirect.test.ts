import { describe, expect, it } from 'vitest';
import { safeNextPath } from '../lib/auth/redirect';

describe('safe post-auth redirects', () => {
  it('preserves a same-site path and its query after sign-in or confirmation', () => {
    expect(safeNextPath('/catalog?brand=Honda&page=2')).toBe('/catalog?brand=Honda&page=2');
  });

  it('falls back for external, protocol-relative, malformed, and auth-loop targets', () => {
    for (const target of ['https://evil.example', '//evil.example/path', '/\\\\evil.example', '/auth/login', '/auth/callback?next=/admin']) {
      expect(safeNextPath(target)).toBe('/admin');
    }
  });

  it('allows a non-default internal destination when explicitly supplied', () => {
    expect(safeNextPath('/requests/new', '/')).toBe('/requests/new');
  });
});
