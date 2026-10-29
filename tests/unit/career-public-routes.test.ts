import { expect, test, vi } from "vitest";

vi.mock("next/server", () => import("../../apps/web/node_modules/next/server.js"));
vi.mock("@clerk/nextjs/server", async () => ({
  ...await import("../../apps/web/node_modules/@clerk/nextjs/dist/cjs/server/routeMatcher.js"),
  clerkMiddleware: (handler: unknown) => handler,
}));

import proxy from "@/proxy";
const request = proxy as unknown as (auth: () => Promise<{ userId: null }>, req: { url: string; nextUrl: URL; headers: Headers }) => Promise<Response>;
const makeRequest = (path: string) => ({ url: `https://www.myaiskilltutor.com${path}`, nextUrl: new URL(`https://www.myaiskilltutor.com${path}`), headers: new Headers() });

test("career tools and the actual PDF are accessible without an account", async () => {
  for (const path of ["/tools/career-remapping", "/downloads/career-remapping-workbook.pdf"]) {
    const response = await request(async () => ({ userId: null }), makeRequest(path));
    expect(response.headers.get("location"), path).toBeNull();
    expect(response.status, path).toBe(200);
  }
  const privateResponse = await request(async () => ({ userId: null }), makeRequest("/dashboard"));
  expect(privateResponse.headers.get("location")).toContain("/sign-in");
});
