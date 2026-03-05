"use client";

import { useEffect, useState } from "react";

type AuthWidgetFallbackProps = {
  mode: "sign-in" | "sign-up";
};

type ClerkDiagnosticPayload = {
  diagnostics?: {
    clientStatus?: number | null;
    clientErrorCode?: string | null;
  };
};

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function AuthWidgetFallback({ mode }: AuthWidgetFallbackProps) {
  const [show, setShow] = useState(false);
  const [local, setLocal] = useState(false);
  const [diag, setDiag] = useState<string | null>(null);

  useEffect(() => {
    const localHost = isLocalHost(window.location.hostname);
    setLocal(localHost);

    const timer = window.setTimeout(async () => {
      const mountedAuthUi = document.querySelector("main form, main input, iframe[data-clerk-provider], [data-clerk-component]");
      if (mountedAuthUi) return;

      setShow(true);

      if (localHost) {
        try {
          const res = await fetch("/api/auth/clerk/diagnostics", { cache: "no-store" });
          const payload = (await res.json().catch(() => ({}))) as ClerkDiagnosticPayload;
          const status = payload.diagnostics?.clientStatus;
          const code = payload.diagnostics?.clientErrorCode;
          if (status || code) {
            setDiag(code ? `${status ?? "unknown"} (${code})` : String(status));
          }
        } catch {
          // Keep fallback visible without diagnostics details.
        }
      }
    }, 3200);

    return () => window.clearTimeout(timer);
  }, []);

  if (!show) return null;

  const actionLabel = mode === "sign-in" ? "sign in" : "sign up";
  const prodPath = mode === "sign-in" ? "/sign-in" : "/sign-up";

  return (
    <section className="mt-4 w-full max-w-xl rounded-2xl border border-amber-300/80 bg-amber-50 p-5 text-left text-[#7c2d12]">
      <h2 className="font-[Outfit] text-lg font-semibold mb-2">Auth widget did not load</h2>
      <p className="text-sm leading-relaxed">
        Clerk did not render the {actionLabel} form in this environment. This usually indicates local origin configuration or key mismatch.
      </p>
      {diag ? (
        <p className="mt-2 text-xs">
          Diagnostic: <span className="font-mono">{diag}</span>
        </p>
      ) : null}
      {local ? (
        <p className="mt-2 text-xs">
          Run <span className="font-mono">curl http://localhost:6396/api/auth/clerk/diagnostics</span> for exact checks.
        </p>
      ) : null}
      <div className="mt-4">
        <a
          className="btn btn-secondary"
          href={`https://www.myaiskilltutor.com${prodPath}`}
          target="_blank"
          rel="noreferrer"
        >
          Open Production {mode === "sign-in" ? "Sign In" : "Sign Up"}
        </a>
      </div>
    </section>
  );
}
