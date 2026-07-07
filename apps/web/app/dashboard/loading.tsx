function SkeletonLine({ className }: { className: string }) {
  return <div className={`rounded-full bg-white/10 animate-pulse ${className}`}></div>;
}

function SidebarRow() {
  return (
    <div className="flex items-center gap-3 rounded-lg px-4 py-3">
      <div className="h-9 w-9 rounded-lg bg-white/10 animate-pulse"></div>
      <SkeletonLine className="h-3 w-24" />
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div
      data-gemini-shell="1"
      className="bg-[#0f111a] text-white lg:flex lg:h-screen lg:overflow-hidden min-h-screen text-sm"
    >
      <aside className="w-full lg:w-72 border-y-0 border-l-0 rounded-none flex flex-col lg:h-full bg-black/20 flex-shrink-0 z-20 relative border-r border-white/5">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/20 animate-pulse"></div>
            <SkeletonLine className="h-4 w-32" />
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 mb-8">
            <div className="h-10 w-10 rounded-full bg-white/10 animate-pulse"></div>
            <div className="space-y-2">
              <SkeletonLine className="h-3 w-24" />
              <SkeletonLine className="h-3 w-16" />
            </div>
          </div>

          <div className="space-y-1">
            {Array.from({ length: 6 }).map((_, index) => (
              <SidebarRow key={index} />
            ))}
          </div>
        </div>

        <div className="mt-auto p-6 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <SkeletonLine className="h-3 w-20" />
            <SkeletonLine className="h-3 w-28" />
            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
              <div className="h-full w-1/3 rounded-full bg-emerald-400/40 animate-pulse"></div>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <SkeletonLine className="h-3 w-24" />
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col lg:h-full relative overflow-y-auto w-full min-w-0">
        <div className="absolute top-0 left-1/4 w-[500px] h-[200px] bg-emerald-500/20 blur-[100px] pointer-events-none"></div>
        <header className="h-20 flex items-center px-4 md:px-8 lg:px-10 border-b border-white/5 sticky top-0 bg-[#0f111a]/80 backdrop-blur-xl z-10 flex-shrink-0">
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonLine className="h-5 w-48" />
            <SkeletonLine className="h-3 w-72 max-w-full" />
          </div>
          <div className="h-10 w-10 rounded-xl bg-white/10 animate-pulse"></div>
        </header>

        <div className="p-6 md:p-10 max-w-6xl mx-auto w-full pb-24 space-y-8">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-3 flex-1">
                <SkeletonLine className="h-5 w-40" />
                <SkeletonLine className="h-4 w-full max-w-2xl" />
                <SkeletonLine className="h-4 w-5/6 max-w-xl" />
              </div>
              <div className="h-11 w-52 rounded-xl bg-emerald-500/20 animate-pulse"></div>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between mb-5">
                  <SkeletonLine className="h-4 w-36" />
                  <SkeletonLine className="h-3 w-14" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div key={index} className="rounded-2xl border border-white/10 bg-black/20 p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="h-10 w-10 rounded-xl bg-white/10 animate-pulse"></div>
                        <SkeletonLine className="h-3 w-16" />
                      </div>
                      <SkeletonLine className="h-4 w-3/4" />
                      <SkeletonLine className="h-3 w-full" />
                      <SkeletonLine className="h-3 w-5/6" />
                      <div className="h-2 w-full rounded-full bg-white/10"></div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between mb-5">
                  <SkeletonLine className="h-4 w-32" />
                  <SkeletonLine className="h-3 w-16" />
                </div>
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
                      <SkeletonLine className="h-4 w-2/3" />
                      <SkeletonLine className="h-3 w-full" />
                      <SkeletonLine className="h-3 w-4/5" />
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="space-y-6">
              {Array.from({ length: 3 }).map((_, index) => (
                <section key={index} className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                  <SkeletonLine className="h-4 w-28" />
                  <SkeletonLine className="h-3 w-full" />
                  <SkeletonLine className="h-3 w-5/6" />
                  <SkeletonLine className="h-3 w-4/6" />
                </section>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
