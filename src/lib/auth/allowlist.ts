export function isAllowed(
  email: string | null | undefined,
  allowed: string | undefined = process.env.ALLOWED_EMAIL,
): boolean {
  if (!email || !allowed) return false;
  const a = email.trim().toLowerCase();
  const b = allowed.trim().toLowerCase();
  return a !== '' && a === b;
}
