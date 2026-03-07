"use client";

import { useEffect } from "react";
import { useClerk } from "@clerk/nextjs";
import { resetAnalytics } from "@/lib/analytics";

function clearAiTutorBrowserState() {
  const prefixes = [
    "ai_tutor_",
    "ph_",
  ];
  const clearStorage = (storage: Storage | null) => {
    if (!storage) return;
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key) keys.push(key);
    }
    for (const key of keys) {
      if (prefixes.some((prefix) => key.startsWith(prefix))) {
        storage.removeItem(key);
      }
    }
  };

  try {
    clearStorage(window.localStorage);
  } catch {
    // no-op
  }

  try {
    clearStorage(window.sessionStorage);
  } catch {
    // no-op
  }
}

export function SignOutClient() {
  const clerk = useClerk();

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        resetAnalytics();
        clearAiTutorBrowserState();
        await clerk.signOut({ redirectUrl: "/" });
      } catch {
        if (active) {
          resetAnalytics();
          clearAiTutorBrowserState();
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
        <p className="text-sm text-slate-600">You will be redirected to home automatically.</p>
      </div>
    </main>
  );
}
