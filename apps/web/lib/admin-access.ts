const DEFAULT_ADMIN_EMAILS = ["msanchezgrice@gmail.com"];

function parseAllowlist(value: string | undefined) {
  const tokens = String(value || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return new Set(tokens.length ? tokens : DEFAULT_ADMIN_EMAILS);
}

export function adminEmailAllowlist() {
  return parseAllowlist(process.env.ADMIN_EMAIL_ALLOWLIST);
}

export function isAdminEmail(email: string | null | undefined) {
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalized) return false;
  return adminEmailAllowlist().has(normalized);
}
