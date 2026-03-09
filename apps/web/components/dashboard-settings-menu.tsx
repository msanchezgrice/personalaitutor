"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { captureAnalyticsEvent } from "@/lib/analytics";

export function DashboardSettingsMenu({ operatorToolsHref = null }: { operatorToolsHref?: string | null }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handleClick(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!rootRef.current || !target) return;
      if (!rootRef.current.contains(target)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function toggleMenu() {
    const nextOpen = !open;
    setOpen(nextOpen);
    captureAnalyticsEvent("dashboard_settings_toggled", {
      is_open: nextOpen,
      location: "header",
    });
  }

  function handleProfileClick() {
    setOpen(false);
    captureAnalyticsEvent("dashboard_settings_item_clicked", {
      item: "profile_settings",
      destination: "/dashboard/profile",
      location: "header",
    });
  }

  function handleOperatorToolsClick() {
    setOpen(false);
    captureAnalyticsEvent("dashboard_settings_item_clicked", {
      item: "operator_tools",
      destination: operatorToolsHref,
      location: "header",
    });
  }

  function handleSignOutClick() {
    setOpen(false);
    captureAnalyticsEvent("auth_sign_out_clicked", {
      auth_provider: "clerk",
      source: "dashboard_settings_menu",
    });
    window.setTimeout(() => {
      window.location.assign("/sign-out");
    }, 75);
  }

  return (
    <div id="dashboard-settings-menu" ref={rootRef} className="relative">
      <button
        type="button"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-black/30 px-3 text-xs text-gray-200 hover:bg-white/10 shadow-[0_6px_18px_rgba(0,0,0,0.25)]"
        data-settings-toggle="1"
        aria-expanded={open ? "true" : "false"}
        aria-haspopup="menu"
        aria-label="Open settings menu"
        onClick={toggleMenu}
      >
        <i className="fa-solid fa-gear"></i>
        <span className="hidden md:inline">Settings</span>
      </button>
      <div
        className={
          (open ? "block" : "hidden") +
          " absolute right-0 top-full mt-2 min-w-[190px] rounded-xl border border-white/15 bg-[#0f111a]/95 backdrop-blur-xl shadow-2xl p-1 z-40"
        }
        data-settings-panel="1"
        role="menu"
      >
        <Link
          href="/dashboard/profile"
          className="block px-3 py-2 text-sm text-gray-100 rounded-lg hover:bg-white/10"
          role="menuitem"
          onClick={handleProfileClick}
        >
          <i className="fa-regular fa-user mr-2"></i>Profile Settings
        </Link>
        {operatorToolsHref ? (
          <a
            href={operatorToolsHref}
            className="block px-3 py-2 text-sm text-emerald-300 rounded-lg hover:bg-emerald-500/20"
            role="menuitem"
            onClick={handleOperatorToolsClick}
          >
            <i className="fa-solid fa-chart-line mr-2"></i>Operator Tools
          </a>
        ) : null}
        <button
          type="button"
          className="w-full text-left px-3 py-2 text-sm text-red-300 rounded-lg hover:bg-red-500/20"
          data-sign-out="1"
          role="menuitem"
          onClick={handleSignOutClick}
        >
          <i className="fa-solid fa-right-from-bracket mr-2"></i>Sign Out
        </button>
      </div>
    </div>
  );
}
