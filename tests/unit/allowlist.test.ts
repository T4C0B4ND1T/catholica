import { describe, expect, it } from 'vitest';
import { isAllowed } from '@/lib/auth/allowlist';

describe('isAllowed', () => {
  it('matches case-insensitively and trims', () => {
    expect(isAllowed('Joel@Example.com ', 'joel@example.com')).toBe(true);
    expect(isAllowed('joel@example.com', ' JOEL@example.com ')).toBe(true);
  });
  it('rejects other emails', () => {
    expect(isAllowed('other@example.com', 'joel@example.com')).toBe(false);
  });
  it('rejects missing email or allowlist', () => {
    expect(isAllowed(null, 'x')).toBe(false);
    expect(isAllowed(undefined, 'x')).toBe(false);
    expect(isAllowed('a@b.c', undefined)).toBe(false);
    expect(isAllowed('', '')).toBe(false);
  });
});
