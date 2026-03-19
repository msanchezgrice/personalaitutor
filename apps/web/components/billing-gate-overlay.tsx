"use client";

import { useState } from "react";

type BillingGateOverlayProps = {
  returnTo?: string | null;
  returnToReport?: string | null;
};

export function BillingGateOverlay({
  returnTo = "/dashboard",
  returnToReport: returnToReportProp = "/onboarding?view=report",
}: BillingGateOverlayProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const returnToReport = returnToReportProp || "/onboarding?view=report";

  async function handleCheckoutStart() {
    try {
      setPending(true);
      setError(null);

      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          returnTo,
        }),
      });
      const payload = await response.json().catch(() => null);
      const checkoutUrl = payload?.url;

      if (!response.ok || typeof checkoutUrl !== "string" || !checkoutUrl) {
        const reason = payload?.error?.details?.reason ?? payload?.error?.reason;
        if (typeof reason === "string" && reason.endsWith("_MISSING")) {
          throw new Error("Billing is still being configured. Please try again in a few minutes.");
        }
        throw new Error(payload?.error?.message || "Unable to start billing checkout");
      }

      window.location.assign(checkoutUrl);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Unable to start billing checkout");
      setPending(false);
    }
  }

  function handleBackToReport() {
    window.location.assign(returnToReport);
  }

  return (
    <div data-billing-gate="1" className="fixed inset-0 z-[80] flex items-center justify-center px-6 py-10">
      <div className="absolute inset-0 bg-[#040816]/80 backdrop-blur-md"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.15),transparent_35%)]"></div>
      <div className="relative z-10 w-full max-w-3xl rounded-[2rem] border border-white/15 bg-[#0b1220]/96 p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.55)] sm:p-10">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/18 text-emerald-200">
          <i className="fa-solid fa-credit-card text-xl"></i>
        </div>
        <h2 className="text-3xl font-[Outfit] leading-tight text-white">
          Your dashboard is ready. Start your 7-day free trial to unlock your personalized modules, AI tutor, daily AI
          news, and social/build-log tools.
        </h2>
        <p className="mt-4 text-base leading-7 text-slate-100">
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
        <p className="mt-5 text-sm text-slate-300">
          Auto-renews at $49.99/month unless canceled before trial end.
        </p>
        {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}
      </div>
    </div>
  );
}
