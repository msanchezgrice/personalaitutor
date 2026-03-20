import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const stylesPath = path.resolve(process.cwd(), "apps/web/public/styles.css");

describe("billing gate theme overrides", () => {
  test("preserves white billing gate copy in the light dashboard theme", () => {
    const source = readFileSync(stylesPath, "utf8");

    expect(source).toContain('[data-billing-gate="1"] [data-billing-gate-heading="1"]');
    expect(source).toContain('[data-billing-gate="1"] [data-billing-gate-error="1"]');
  });
});
