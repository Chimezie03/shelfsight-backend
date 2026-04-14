import { describe, it, expect } from 'vitest';
import { normalizeEmail } from '../src/lib/email';

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Test@Example.COM  ')).toBe('test@example.com');
  });

  it('handles already normalized input', () => {
    expect(normalizeEmail('a@b.co')).toBe('a@b.co');
  });
});
