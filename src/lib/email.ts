/**
 * Canonical email normalization for auth and user management (Task 5).
 * Trim whitespace and lowercase so lookups and uniqueness are consistent.
 */
export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}
