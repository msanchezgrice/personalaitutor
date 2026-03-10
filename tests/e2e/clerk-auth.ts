import path from "node:path";
import { mkdir } from "node:fs/promises";

const DEFAULT_E2E_EMAIL = "playwright+dashboard@myaiskilltutor.dev";

try {
  process.loadEnvFile?.(".env.local");
} catch {}

try {
  process.loadEnvFile?.(".env");
} catch {}

export const clerkAuthStatePath = path.resolve(process.cwd(), "playwright/.clerk/dashboard-user.json");

export function clerkE2EEmail() {
  return process.env.E2E_CLERK_USER_EMAIL?.trim() || DEFAULT_E2E_EMAIL;
}

export function hasClerkAuthEnv() {
  return Boolean(
    process.env.CLERK_SECRET_KEY?.trim()
      && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim(),
  );
}

export async function ensureClerkAuthStateDir() {
  await mkdir(path.dirname(clerkAuthStatePath), { recursive: true });
}

export async function ensureClerkE2EUser() {
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY is required to create the Playwright Clerk user.");
  }

  const email = clerkE2EEmail();
  const response = await fetch("https://api.clerk.com/v1/users", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secretKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email_address: [email],
      password: `Playwright!${new Date().getUTCFullYear()}Tutor123`,
      first_name: "Playwright",
      last_name: "Dashboard",
    }),
  });

  if (response.ok) {
    return { email, created: true as const };
  }

  const detail = await response.text();
  if (response.status === 422 || response.status === 409) {
    const normalized = detail.toLowerCase();
    if (
      normalized.includes("already exists")
      || normalized.includes("already been taken")
      || normalized.includes(email.toLowerCase())
      || normalized.includes("email_address")
    ) {
      return { email, created: false as const };
    }
  }

  throw new Error(`CLERK_E2E_USER_CREATE_FAILED:${response.status}:${detail.slice(0, 240)}`);
}
