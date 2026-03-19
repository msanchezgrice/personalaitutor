"use client";

import { useState } from "react";

type BillingGateOverlayProps = {
  returnTo?: string | null;
};

export function BillingGateOverlay({ returnTo = "/dashboard" }: BillingGateOverlayProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckoutStart() {
    try {
      setPending(true);
      setError(null);

      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          returnTo,
        }),
      });
      const payload = await response.json().catch(() => null);
      const checkoutUrl = payload?.url;

      if (!response.ok || typeof checkoutUrl !== "string" || !checkoutUrl) {
        throw new Error(payload?.error?.message || "Unable to start checkout");
      }

      window.location.assign(checkoutUrl);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Unable to start checkout");
      setPending(false);
    }
  }

  function handleBackToReport() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.assign("/onboarding/");
  }

  return (
    <div
      data-billing-gate="1"
      className="absolute inset-0 z-30 flex items-center justify-center px-6 py-10"
    >
      <div className="absolute inset-0 rounded-[2rem] bg-[#050816]/70 backdrop-blur-sm"></div>
      <div className="relative z-10 max-w-xl rounded-[2rem] border border-white/15 bg-[#101523]/90 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
          <i className="fa-solid fa-credit-card text-xl"></i>
        </div>
        <h2 className="text-2xl font-[Outfit] text-white">
          Your dashboard is ready. Start your 7-day free trial to unlock your personalized modules, AI tutor, daily AI
          news, and social/build-log tools.
        </h2>
        <p className="mt-4 text-sm text-gray-300">
          Card required today. You will not be charged until your trial ends.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            data-billing-gate-checkout="1"
            className="btn btn-primary min-w-[220px] justify-center disabled:cursor-not-allowed disabled:opacity-70"
            disabled={pending}
            onClick={handleCheckoutStart}
          >
            {pending ? "Redirecting..." : "Start 7-Day Free Trial"}
          </button>
          <button
            type="button"
            data-billing-gate-back="1"
            className="btn btn-secondary min-w-[220px] justify-center"
            disabled={pending}
            onClick={handleBackToReport}
          >
            Back to My Report
          </button>
        </div>
        <p className="mt-4 text-xs text-gray-400">
          Auto-renews at $49.99/month unless canceled before trial end.
        </p>
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      </div>
    </div>
  );
}
