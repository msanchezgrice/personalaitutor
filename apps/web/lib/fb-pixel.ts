/**
 * Facebook Pixel tracking utility.
 *
 * Standard events mapped to the user funnel:
 *   1. PageView          – fires automatically via base pixel on every page load
 *   2. ViewContent        – landing page / key content views
 *   3. CompleteRegistration – Clerk sign-up completes (account created)
 *   4. Lead               – quiz / assessment completed
 *   5. Subscribe          – paid subscription (future)
 *   6. Purchase           – one-time purchase  (future)
 *
 * Custom events (prefixed with app namespace):
 *   - OnboardingStart     – user begins the onboarding wizard
 *   - QuizStart           – assessment attempt started
 *   - QuizComplete        – assessment submitted with score
 *   - OnboardingComplete  – user finishes full onboarding
 *
 * Usage:
 *   import { fbEvent, fbCustomEvent } from "@/lib/fb-pixel";
 *   fbEvent("CompleteRegistration", { content_name: "clerk_signup" });
 *   fbCustomEvent("QuizComplete", { score: 0.82 });
 */

/* ---------- helpers ---------- */

/** True when running in the browser and the pixel snippet has loaded. */
function pixelReady(): boolean {
  return typeof window !== "undefined" && typeof window.fbq === "function";
}

/* ---------- public API ---------- */

/**
 * Fire a Facebook standard event.
 * @see https://developers.facebook.com/docs/meta-pixel/reference#standard-events
 */
export function fbEvent(
  name: string,
  params?: Record<string, unknown>,
  eventId?: string,
): void {
  if (!pixelReady()) return;
  const eventOptions = eventId ? { eventID: eventId } : undefined;
  if (params && eventOptions) {
    window.fbq("track", name, params, eventOptions);
    return;
  }
  if (params) {
    window.fbq("track", name, params);
    return;
  }
  if (eventOptions) {
    window.fbq("track", name, undefined, eventOptions);
    return;
  }
  window.fbq("track", name);
}

/**
 * Fire a Facebook custom event (trackCustom).
 */
export function fbCustomEvent(
  name: string,
  params?: Record<string, unknown>,
  eventId?: string,
): void {
  if (!pixelReady()) return;
  const eventOptions = eventId ? { eventID: eventId } : undefined;
  if (params && eventOptions) {
    window.fbq("trackCustom", name, params, eventOptions);
    return;
  }
  if (params) {
    window.fbq("trackCustom", name, params);
    return;
  }
  if (eventOptions) {
    window.fbq("trackCustom", name, undefined, eventOptions);
    return;
  }
  window.fbq("trackCustom", name);
}

/* ---------- convenience wrappers ---------- */

/** Landing / key content page view (beyond the automatic PageView). */
export function fbViewContent(contentName: string, extras?: Record<string, unknown>) {
  fbEvent("ViewContent", { content_name: contentName, ...extras });
}

/** Clerk sign-up completed → CompleteRegistration. */
export function fbCompleteRegistration(method = "clerk", eventId?: string) {
  fbEvent("CompleteRegistration", {
    content_name: "signup",
    status: true,
    method,
  }, eventId);
}

/** Assessment / quiz submitted → Lead. */
export function fbQuizComplete(score: number, recommendedPaths?: string[], eventId?: string) {
  // Standard event for the ad optimiser
  fbEvent("Lead", {
    content_name: "assessment_complete",
    content_category: "quiz",
    value: score,
    currency: "USD",
  }, eventId);
  // Richer custom event for internal reporting
  fbCustomEvent("QuizComplete", {
    score,
    recommended_paths: recommendedPaths?.join(",") ?? "",
  }, eventId ? `${eventId}_quiz_complete` : undefined);
}

/** User starts onboarding wizard. */
export function fbOnboardingStart(eventId?: string) {
  fbCustomEvent("OnboardingStart", undefined, eventId);
}

/** User starts an assessment attempt. */
export function fbQuizStart(eventId?: string) {
  fbCustomEvent("QuizStart", undefined, eventId);
}

/** Full onboarding flow completed (all steps done). */
export function fbOnboardingComplete(eventId?: string) {
  fbCustomEvent("OnboardingComplete", undefined, eventId);
}

/** User starts Stripe checkout. */
export function fbInitiateCheckout(value?: number, currency = "USD", eventId?: string) {
  fbEvent("InitiateCheckout", {
    value,
    currency,
  }, eventId);
}

/** Future: Subscription purchased. */
export function fbSubscribe(value: number, currency = "USD", planId?: string, eventId?: string) {
  fbEvent("Subscribe", { value, currency, predicted_ltv: value, content_name: planId }, eventId);
}

/** Future: One-time purchase. */
export function fbPurchase(value: number, currency = "USD", contentId?: string, eventId?: string) {
  fbEvent("Purchase", { value, currency, content_ids: contentId ? [contentId] : undefined }, eventId);
}

/* ---------- TypeScript global augmentation ---------- */

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
  }
}
