import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const dashboardSettingsMenuPath = path.resolve(process.cwd(), "apps/web/components/dashboard-settings-menu.tsx");

describe("dashboard auth control", () => {
  test("replaces the old settings dropdown with direct auth actions", () => {
    const source = readFileSync(dashboardSettingsMenuPath, "utf8");

    expect(source).toContain("Sign Out");
    expect(source).toContain("Sign In");
    expect(source).toContain("/sign-out");
    expect(source).toContain("/sign-in?redirect_url=/dashboard/");
    expect(source).not.toContain("Profile Settings");
    expect(source).not.toContain("Manage Billing");
    expect(source).not.toContain("Operator Tools");
  });
});
