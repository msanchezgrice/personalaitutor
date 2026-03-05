import { NextRequest } from "next/server";

export function getUserId(req: NextRequest) {
  const fromHeader = req.headers.get("x-user-id")?.trim();
  return fromHeader || null;
}

export function forcedFailCode(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return undefined;
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
