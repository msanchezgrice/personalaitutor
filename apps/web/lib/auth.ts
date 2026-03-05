import { auth, currentUser } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

type AuthSeed = {
  userId: string;
  name?: string;
  handleBase?: string;
  avatarUrl?: string | null;
  email?: string | null;
};

function safeHandle(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function userIdFromProxyHeader(req?: NextRequest) {
  if (!req) return null;
  const fromHeader = req.headers.get("x-user-id")?.trim();
  return fromHeader || null;
}

export async function getAuthUserId(req?: NextRequest) {
  try {
    const session = await auth();
    if (session.userId) return session.userId;
  } catch {
    // Continue with proxy header fallback below.
  }
  return userIdFromProxyHeader(req);
}

export async function getAuthSeed(req?: NextRequest): Promise<AuthSeed | null> {
  const userId = await getAuthUserId(req);
  if (!userId) return null;

  let name: string | undefined;
  let email: string | null | undefined;
  let avatarUrl: string | null | undefined;
  let handleBase: string | undefined;

  try {
    const user = await currentUser();
    if (user) {
      name = user.fullName?.trim() || [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || undefined;
      email = user.emailAddresses?.find((entry) => entry.id === user.primaryEmailAddressId)?.emailAddress ?? null;
      avatarUrl = user.imageUrl ?? null;
      if (user.username?.trim()) {
        handleBase = safeHandle(user.username);
      } else if (name) {
        handleBase = safeHandle(name);
      } else if (email) {
        handleBase = safeHandle(email.split("@")[0] || "");
      }
    }
  } catch {
    // Use identity-only fallback.
  }

  return {
    userId,
    name,
    handleBase: handleBase || safeHandle(userId.slice(0, 16)),
    avatarUrl: avatarUrl ?? null,
    email: email ?? null,
  };
}
