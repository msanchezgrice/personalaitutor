"use client";

import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";

type SignInOauthButtonsProps = {
  redirectUrl: string;
};

export function SignInOauthButtons({ redirectUrl }: SignInOauthButtonsProps) {
  const { isLoaded, signIn } = useSignIn();
  const [busy, setBusy] = useState<null | "google">(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    if (!isLoaded || !signIn) return;
    setBusy("google");
    setError(null);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: redirectUrl,
      });
    } catch {
      setError("Google sign-in is currently unavailable.");
      setBusy(null);
    }
  }

  return (
    <div className="w-full max-w-[26rem] mb-4">
      <button
        type="button"
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        onClick={() => void handleGoogle()}
        disabled={!isLoaded || busy === "google"}
      >
        Continue with Google
      </button>
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

