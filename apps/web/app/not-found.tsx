import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="min-h-screen bg-[#0f111a] text-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl text-center">
        <div className="inline-flex items-center gap-3 mb-6">
          <img src="/assets/branding/brand_brain_icon.svg" alt="My AI Skill Tutor" className="h-9 w-9 object-contain" />
          <span className="font-[Outfit] font-bold text-2xl tracking-tight">My AI Skill Tutor</span>
        </div>
        <h1 className="text-4xl font-[Outfit] font-semibold mb-3">Page not found</h1>
        <p className="text-slate-300 mb-8">This page does not exist.</p>
        <div className="flex justify-center">
          <Link className="btn btn-primary" href="/">
            Go Home
          </Link>
        </div>
      </div>
    </main>
  );
}
