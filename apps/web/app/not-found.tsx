import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="min-h-screen bg-[#0f111a] text-white flex items-center justify-center px-6 py-12">
      <div className="glass max-w-xl w-full p-8 text-center">
        <h1 className="text-3xl mb-3">Page not found</h1>
        <p className="text-gray-400 mb-6">The page you requested does not exist or may have moved.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link className="btn btn-primary" href="/">
            Go home
          </Link>
          <Link className="btn btn-secondary" href="/onboarding">
            Start assessment
          </Link>
        </div>
      </div>
    </main>
  );
}
