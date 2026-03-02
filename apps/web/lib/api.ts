import { NextRequest } from "next/server";

export function getUserId(req: NextRequest) {
  const fromHeader = req.headers.get("x-user-id");
  const fromQuery = req.nextUrl.searchParams.get("userId");
  const value = fromHeader ?? fromQuery ?? "user_test_0001";
  if (value === "user_test_0001") return "00000000-0000-0000-0000-000000000001";
  return value;
}

export function forcedFailCode(req: NextRequest) {
  return req.headers.get("x-force-fail") ?? req.nextUrl.searchParams.get("forceFailCode") ?? undefined;
}

export function missingEnv(keys: string[]) {
  const missing: string[] = [];
  for (const key of keys) {
    if (!process.env[key]) missing.push(key);
  }
  return missing;
}

export function noStoreHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  headers.set("cache-control", "no-store");
  return headers;
}

export function parseBoolean(value: string | null) {
  if (!value) return false;
  return value === "1" || value.toLowerCase() === "true";
}
