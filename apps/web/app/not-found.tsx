import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-6 py-12"
      style={{
        background:
          "radial-gradient(circle at top, rgba(16,185,129,0.14), transparent 32%), linear-gradient(180deg, #f4f8f5 0%, #eef7f3 100%)",
      }}
    >
      <div
        className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-8 md:p-12 text-center text-slate-900"
        style={{
          boxShadow: "0 24px 80px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div className="inline-flex items-center gap-3 mb-8">
          <img src="/assets/branding/brand_brain_icon.svg" alt="My AI Skill Tutor" className="h-11 w-11 object-contain" />
          <span className="font-[Outfit] font-bold text-[1.8rem] tracking-tight text-slate-900">My AI Skill Tutor</span>
        </div>
        <div className="mx-auto mb-4 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm text-emerald-700">
          Error 404
        </div>
        <h1 className="font-[Outfit] text-4xl md:text-5xl font-semibold tracking-tight mb-4">Page not found</h1>
        <p className="mx-auto max-w-lg text-slate-600 text-base md:text-lg leading-7 mb-10">
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
