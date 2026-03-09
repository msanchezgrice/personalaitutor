import { describe, expect, test } from "vitest";
import {
  appendLifecycleEmailTracking,
  buildLifecycleEmail,
  readLifecycleEmailTracking,
  resolveLifecycleEmailKey,
} from "../../packages/shared/src";

describe("lifecycle email helpers", () => {
  test("welcome is always first when it has not been sent", () => {
    const next = resolveLifecycleEmailKey({
      anchorIso: "2026-03-01T12:00:00.000Z",
      nowIso: "2026-03-10T12:00:00.000Z",
      sentKeys: [],
    });

    expect(next).toBe("welcome");
  });

  test("resolver picks the current stage instead of replaying the full backlog", () => {
    const next = resolveLifecycleEmailKey({
      anchorIso: "2026-03-01T12:00:00.000Z",
      nowIso: "2026-03-09T12:00:00.000Z",
      sentKeys: ["welcome"],
    });

    expect(next).toBe("week_1_digest");
  });

  test("day one completed email includes quiz feedback and a module CTA", () => {
    const email = buildLifecycleEmail({
      key: "day_1_next_steps",
      baseUrl: "https://www.myaiskilltutor.com",
      learnerName: "Miguel",
      learnerHandle: "miguel",
      careerPathName: "Software Engineering",
      goals: ["ship_ai_projects"],
      dashboardUrl: "https://www.myaiskilltutor.com/dashboard/",
      publicProfileUrl: "https://www.myaiskilltutor.com/u/miguel",
      assessment: {
        score: 0.74,
        answers: [
          { questionId: "ai_comfort", value: 4 },
          { questionId: "career_experience", value: 5 },
        ],
        recommendedCareerPathIds: ["software-engineering", "product-management"],
        startedAt: "2026-03-02T12:00:00.000Z",
        submittedAt: "2026-03-02T12:05:00.000Z",
      },
      moduleCta: {
        title: "API Integration",
        href: "https://www.myaiskilltutor.com/dashboard/?module=API%20Integration",
        buttonLabel: "Continue API Integration",
        helperText: "Keep building from the module you already started.",
      },
    });

    expect(email.subject).toContain("quiz results");
    expect(email.html).toContain("AI comfort");
    expect(email.html).toContain("Recommended paths");
    expect(email.text).toContain("Continue API Integration");
  });

  test("week one digest includes social drafts and AI news", () => {
    const email = buildLifecycleEmail({
      key: "week_1_digest",
      baseUrl: "https://www.myaiskilltutor.com",
      learnerName: "Miguel",
      learnerHandle: "miguel",
      careerPathName: "Software Engineering",
      dashboardUrl: "https://www.myaiskilltutor.com/dashboard/",
      publicProfileUrl: "https://www.myaiskilltutor.com/u/miguel",
      moduleCta: {
        title: "System Architecture",
        href: "https://www.myaiskilltutor.com/dashboard/?module=System%20Architecture",
        buttonLabel: "Continue System Architecture",
        helperText: "Keep building from the module you already started.",
      },
      project: {
        title: "Support Copilot",
        url: "https://www.myaiskilltutor.com/u/miguel/projects/support-copilot",
        state: "building",
      },
      socialDrafts: [
        { platform: "linkedin", text: "I turned this week into visible proof." },
        { platform: "x", text: "Shipping proof, not just notes." },
      ],
      newsItems: [
        {
          title: "Model eval gates are getting stricter",
          summary: "Teams are hardening release checks.",
          url: "https://example.com/evals",
          source: "OpenAI News",
          whyRelevant: "This matters if you are shipping user-facing AI workflows.",
          recommendedAction: "Add one verification check to your next build.",
        },
      ],
    });

    expect(email.subject).toContain("Week 1 digest");
    expect(email.html).toContain("Draft social posts");
    expect(email.html).toContain("Model eval gates are getting stricter");
    expect(email.text).toContain("LinkedIn draft");
  });

  test("tracked email URLs preserve attribution params", () => {
    const tracked = appendLifecycleEmailTracking({
      url: "https://www.myaiskilltutor.com/dashboard/?welcome=1",
      campaignKey: "day_1_next_steps",
      deliveryId: "delivery_123",
      cta: "dashboard",
    });

    const parsed = readLifecycleEmailTracking(tracked);
    expect(parsed.utmSource).toBe("lifecycle_email");
    expect(parsed.utmMedium).toBe("email");
    expect(parsed.utmCampaign).toBe("day_1_next_steps");
    expect(parsed.utmContent).toBe("dashboard");
    expect(parsed.emailDeliveryId).toBe("delivery_123");
    expect(parsed.linkPath).toBe("/dashboard/");
  });

  test("week one digest keeps social draft links clean while footer links stay tracked", () => {
    const cleanPublicProfile = "https://www.myaiskilltutor.com/u/miguel";
    const trackedPublicProfile = appendLifecycleEmailTracking({
      url: cleanPublicProfile,
      campaignKey: "week_1_digest",
      deliveryId: "delivery_week1",
      cta: "public_profile",
    });

    const email = buildLifecycleEmail({
      key: "week_1_digest",
      baseUrl: "https://www.myaiskilltutor.com",
      learnerName: "Miguel",
      learnerHandle: "miguel",
      careerPathName: "Software Engineering",
      dashboardUrl: "https://www.myaiskilltutor.com/dashboard/",
      dashboardTrackingUrl: appendLifecycleEmailTracking({
        url: "https://www.myaiskilltutor.com/dashboard/",
        campaignKey: "week_1_digest",
        deliveryId: "delivery_week1",
        cta: "dashboard",
      }),
      publicProfileUrl: cleanPublicProfile,
      publicProfileTrackingUrl: trackedPublicProfile,
      moduleCta: {
        title: "System Architecture",
        href: appendLifecycleEmailTracking({
          url: "https://www.myaiskilltutor.com/dashboard/?module=System%20Architecture",
          campaignKey: "week_1_digest",
          deliveryId: "delivery_week1",
          cta: "module_cta",
        }),
        buttonLabel: "Continue System Architecture",
        helperText: "Keep building from the module you already started.",
      },
    });

    expect(email.text).toContain(cleanPublicProfile);
    expect(email.text).toContain(trackedPublicProfile);
    expect(email.text).toContain("utm_source=lifecycle_email");
  });
});
