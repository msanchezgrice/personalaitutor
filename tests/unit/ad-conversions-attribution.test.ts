import { describe, expect, test } from "vitest";
import { buildServerConversionPayload } from "@/lib/ad-conversions";

describe("ad conversion attribution payload", () => {
  test("includes visitor identity and UTM attribution in the server relay payload", () => {
    const payload = buildServerConversionPayload(
      {
        event: "lead",
        eventId: "lead_evt_1",
        source: "onboarding_complete",
        sessionId: "session_1",
        score: 84,
      },
      {
        sourceUrl: "https://www.myaiskilltutor.com/onboarding?utm_source=facebook",
        visitorId: "visitor_1",
        attribution: {
          first: {
            utmSource: "facebook",
            utmMedium: "paid_social",
            utmCampaign: "spring_launch",
            landingPath: "/",
          },
          last: {
            utmSource: "facebook",
            utmMedium: "paid_social",
            utmCampaign: "spring_launch",
            utmContent: "video_a",
            landingPath: "/onboarding",
          },
        },
      },
    );

    expect(payload.visitorId).toBe("visitor_1");
    expect(payload.sourceUrl).toBe("https://www.myaiskilltutor.com/onboarding?utm_source=facebook");
    expect(payload.utmSource).toBe("facebook");
    expect(payload.utmMedium).toBe("paid_social");
    expect(payload.utmCampaign).toBe("spring_launch");
    expect(payload.utmContent).toBe("video_a");
    expect(payload.landingPath).toBe("/onboarding");
    expect(payload.firstUtmSource).toBe("facebook");
  });
});
