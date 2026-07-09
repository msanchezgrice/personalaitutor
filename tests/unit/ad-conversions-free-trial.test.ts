import { describe, expect, test } from "vitest";
import {
  resolveCheckoutCompletedConversionValue,
  resolveCheckoutStartedConversionValue,
} from "@/lib/ad-conversions";

/**
 * Adopted from park/wip-funnel-tests. checkout_completed fires when the FREE
 * TRIAL starts — no money has moved — so it must not report the $49.99
 * subscription price as conversion value to ad networks. Real revenue is
 * relayed by the first-paid-invoice webhook (billing-conversion-relay).
 */

describe("ad conversion free-trial values", () => {
  test("checkout start still defaults to the first billed monthly price", () => {
    expect(resolveCheckoutStartedConversionValue()).toBe(49.99);
  });

  test("checkout complete does not default to the first billed monthly price during the free trial", () => {
    expect(resolveCheckoutCompletedConversionValue()).toBeUndefined();
  });

  test("checkout complete preserves an explicit override when one is provided", () => {
    expect(resolveCheckoutCompletedConversionValue(49.99)).toBe(49.99);
  });
});
