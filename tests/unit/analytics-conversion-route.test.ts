import { beforeEach, describe, expect, test, vi } from "vitest";

class MockNextRequest extends Request {
  cookies = {
    get: vi.fn((_name: string) => undefined),
  };
}

vi.mock("next/server", () => ({
  NextRequest: MockNextRequest,
}), { virtual: true });

import { POST as conversionPost } from "../../apps/web/app/api/analytics/conversion/route";

describe("analytics conversion route", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    delete process.env.META_PIXEL_ID;
    delete process.env.NEXT_PUBLIC_FB_PIXEL_ID;
    delete process.env.META_CONVERSIONS_ACCESS_TOKEN;
    delete process.env.LINKEDIN_CONVERSIONS_API_URL;
    delete process.env.LINKEDIN_CONVERSIONS_API_TOKEN;
    delete process.env.X_CONVERSIONS_API_URL;
    delete process.env.X_CONVERSIONS_API_TOKEN;
  });

  test("relays checkout completion to Google Ads when a click id is available", async () => {
    process.env.GOOGLE_ADS_CUSTOMER_ID = "1234567890";
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "dev-token";
    process.env.GOOGLE_ADS_CLIENT_ID = "client-id";
    process.env.GOOGLE_ADS_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_ADS_REFRESH_TOKEN = "refresh-token";
    process.env.GOOGLE_ADS_CHECKOUT_COMPLETED_CONVERSION_ACTION =
      "customers/1234567890/conversionActions/555";

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "ya29.token" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ results: [{}] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const response = await conversionPost(
      new MockNextRequest("http://localhost/api/analytics/conversion", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "vitest",
          "x-forwarded-for": "203.0.113.10",
        },
        body: JSON.stringify({
          event: "checkout_completed",
          eventId: "checkout_evt_123",
          sourceUrl: "https://www.myaiskilltutor.com/dashboard?billing=success",
          sessionId: "cs_test_123",
          value: 49.99,
          currency: "USD",
          gclid: "gclid_test_123",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.relays).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "google",
          delivered: true,
        }),
      ]),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const googleUploadCall = fetchMock.mock.calls[1];
    expect(String(googleUploadCall?.[0])).toContain(
      "https://googleads.googleapis.com/v22/customers/1234567890:uploadClickConversions",
    );

    const uploadBody = JSON.parse(String(googleUploadCall?.[1]?.body));
    expect(uploadBody.conversions[0]).toMatchObject({
      conversionAction: "customers/1234567890/conversionActions/555",
      gclid: "gclid_test_123",
      currencyCode: "USD",
      conversionValue: 49.99,
      orderId: "cs_test_123",
    });
  });
});
