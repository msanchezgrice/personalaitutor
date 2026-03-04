"use client";

import { useEffect } from "react";
import { useClerk } from "@clerk/nextjs";

export function SignOutClient() {
  const clerk = useClerk();

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await clerk.signOut({ redirectUrl: "/" });
      } catch {
        if (active) {
          window.location.href = "/";
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [clerk]);

  return (
    <main className="min-h-screen bg-[#eef3f2] text-[#0f172a] flex items-center justify-center px-6 py-10">
      <div className="glass p-8 rounded-2xl w-full max-w-md text-center border border-slate-300/60 bg-white">
        <h1 className="font-[Outfit] text-2xl font-semibold mb-2">Signing you out…</h1>
        <p className="text-sm text-slate-600 mb-5">If this takes too long, use the button below.</p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            void clerk.signOut({ redirectUrl: "/" }).catch(() => {
              window.location.href = "/";
            });
          }}
        >
          Finish Sign Out
        </button>
      </div>
    </main>
  );
}
