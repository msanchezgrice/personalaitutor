/**
 * Left panel of /sign-up when the visitor arrives from a career map
 * (`?from=map`, see CAREER_MAP_SIGNUP_HREF). Says the map is saved and what
 * Proof Studio builds next. Without `from=map` the page keeps its default panel.
 */

export function isSignUpFromMap(from: string | string[] | undefined | null) {
  const value = Array.isArray(from) ? from[0] : from;
  return typeof value === "string" && value.trim().toLowerCase() === "map";
}

const PIECES = [
  { title: "A public site", copy: "A page with your new title and how what you did before translates to it." },
  { title: "A voice model", copy: "Tuned in context on your own writing. Visitors compare it with the untuned model." },
  { title: "A build log", copy: "Short public posts about what you built, what broke and what you changed." },
] as const;

export function SignUpMapPanel() {
  return (
    <section className="max-w-xl space-y-4 sm:space-y-6" data-testid="sign-up-from-map">
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 shadow-sm sm:px-4 sm:py-2 sm:text-xs">
        Career map saved
      </span>
      <div className="space-y-3 sm:space-y-4">
        <h1 className="font-[Outfit] text-3xl font-semibold leading-[1.05] tracking-tight text-slate-950 sm:text-5xl">
          Your map is saved. Now build the proof.
        </h1>
        <p className="max-w-lg text-sm leading-6 text-slate-600 sm:text-lg sm:leading-7">
          Create your account and your career map comes with you. Next, Proof Studio helps you build three public pieces that back up your new title.
        </p>
      </div>
      <ol className="grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
        {PIECES.map((piece, index) => (
          <li key={piece.title} className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {index + 1}. {piece.title}
            </div>
            <div className="mt-2 font-medium text-slate-900">{piece.copy}</div>
          </li>
        ))}
      </ol>
      <p className="text-sm leading-6 text-slate-600" data-testid="sign-up-from-map-pricing">
        7-day free trial, then $49.99/month. Card required. Cancel any time.
      </p>
    </section>
  );
}
