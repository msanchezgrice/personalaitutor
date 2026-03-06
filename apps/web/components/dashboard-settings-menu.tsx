"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function DashboardSettingsMenu() {
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

  return (
    <div id="dashboard-settings-menu" ref={rootRef} className="relative">
      <button
        type="button"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-gray-300 hover:bg-white/10"
        data-settings-toggle="1"
        aria-expanded={open ? "true" : "false"}
        aria-haspopup="menu"
        aria-label="Open settings menu"
        onClick={() => setOpen((value) => !value)}
      >
        <i className="fa-solid fa-gear"></i>
        <span className="hidden md:inline">Settings</span>
      </button>
      <div
        className={
          (open ? "block" : "hidden") +
          " absolute right-0 top-full mt-2 min-w-[170px] rounded-xl border border-white/10 bg-[#0f111a]/95 backdrop-blur-xl shadow-2xl p-1 z-40"
        }
        data-settings-panel="1"
        role="menu"
      >
        <Link
          href="/dashboard/profile"
          className="block px-3 py-2 text-sm text-gray-200 rounded-lg hover:bg-white/10"
          role="menuitem"
          onClick={() => setOpen(false)}
        >
          <i className="fa-regular fa-user mr-2"></i>Profile Settings
        </Link>
        <button
          type="button"
          className="w-full text-left px-3 py-2 text-sm text-red-300 rounded-lg hover:bg-red-500/20"
          data-sign-out="1"
          role="menuitem"
          onClick={() => {
            setOpen(false);
            window.location.assign("/sign-out");
          }}
        >
          <i className="fa-solid fa-right-from-bracket mr-2"></i>Sign Out
        </button>
      </div>
    </div>
  );
}
