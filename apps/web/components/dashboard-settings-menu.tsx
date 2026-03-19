"use client";

import { captureAnalyticsEvent } from "@/lib/analytics";

export function DashboardSettingsMenu({
  signedIn = false,
}: {
  signedIn?: boolean;
}) {
  const href = signedIn ? "/sign-out" : "/sign-in?redirect_url=/dashboard/";
  const label = signedIn ? "Sign Out" : "Sign In";
  const icon = signedIn ? "fa-right-from-bracket" : "fa-right-to-bracket";

  function handleClick() {
    captureAnalyticsEvent(signedIn ? "auth_sign_out_clicked" : "auth_sign_in_clicked", {
      auth_provider: "clerk",
      source: "dashboard_header_auth_action",
    });
  }

  return (
    <a
      href={href}
      className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-black/30 px-3 text-xs font-medium text-gray-100 hover:bg-white/10 shadow-[0_6px_18px_rgba(0,0,0,0.25)]"
      data-settings-toggle="1"
      data-auth-action={signedIn ? "sign-out" : "sign-in"}
      aria-label={label}
      onClick={handleClick}
    >
      <i className={`fa-solid ${icon}`}></i>
      <span className="hidden md:inline">{label}</span>
    </a>
  );
}
