import { createElement } from "react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server.node.js";
import { describe, expect, test } from "vitest";
import { AdminSupportPageView } from "@/components/admin-support-page-view";

describe("admin support page view", () => {
  test("renders an empty-state customer service inbox", () => {
    const html = renderToStaticMarkup(
      createElement(AdminSupportPageView, {
        rows: [],
        isLoading: false,
      }),
    );

    expect(html).toContain("Customer Service");
    expect(html).toContain("Open customer inbox");
    expect(html).toContain("No customers found.");
    expect(html).toContain("History");
  });
});
