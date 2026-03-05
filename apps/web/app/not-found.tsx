import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-6 py-12"
      style={{
        background:
          "radial-gradient(circle at top, rgba(16,185,129,0.18), transparent 28%), linear-gradient(180deg, #0f172a 0%, #111827 100%)",
      }}
    >
      <div
        className="w-full max-w-2xl rounded-[28px] border border-white/10 p-8 md:p-12 text-center text-white"
        style={{
          background: "rgba(15, 23, 42, 0.76)",
          boxShadow: "0 24px 80px rgba(2, 6, 23, 0.4)",
          backdropFilter: "blur(18px)",
        }}
      >
        <div className="inline-flex items-center gap-3 mb-8">
          <img src="/assets/branding/brand_brain_icon.svg" alt="My AI Skill Tutor" className="h-11 w-11 object-contain" />
          <span className="font-[Outfit] font-bold text-[1.8rem] tracking-tight">My AI Skill Tutor</span>
        </div>
        <div className="mx-auto mb-4 inline-flex items-center rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-1.5 text-sm text-emerald-200">
          Error 404
        </div>
        <h1 className="font-[Outfit] text-4xl md:text-5xl font-semibold tracking-tight mb-4">Page not found</h1>
        <p className="mx-auto max-w-lg text-slate-300 text-base md:text-lg leading-7 mb-10">
          The page you requested does not exist, moved, or is not available from this account.
        </p>
        <div className="flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-2xl px-6 py-3 font-semibold text-white no-underline"
            style={{
              background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
              boxShadow: "0 18px 44px rgba(16, 185, 129, 0.28)",
            }}
          >
            Go Home
          </Link>
        </div>
      </div>
    </main>
  );
}
