import { DashboardShell } from "@/components/dashboard-runtime-shell";
import { getDashboardServerState } from "@/app/dashboard/_lib";

export default async function DashboardProfilePage() {
  const state = await getDashboardServerState();
  const user = state.user;
  const displayName = user?.name?.trim() || state.seed?.name?.trim() || "New Learner";
  const displayHeadline = user?.headline?.trim() || "AI Builder";
  const displayBio = user?.bio?.trim() || "Building practical AI workflows and sharing public proof of execution.";
  const linkedInUrl = user?.socialLinks?.linkedin?.trim() || "";
  const avatarUrl = user?.avatarUrl?.trim() || state.seed?.avatarUrl?.trim() || "/assets/avatar.png";
  const privatePreviewUrl = user?.handle ? `/u/${user.handle}/` : "/dashboard/profile";
  const publicProfileUrl = state.publicProfileUrl;
  const displayEmail = state.seed?.email?.trim() || "No email on file";
  return (
    <DashboardShell
      activeTab="profile"
      headerTitle={(
        <span className="flex items-center gap-3">
          <i className="fa-solid fa-user text-emerald-400"></i> Profile Settings
        </span>
      )}
      hideHeaderActionsOnMobile
      operatorToolsHref={state.operatorToolsUrl}
      initialUser={{
        name: displayName,
        headline: displayHeadline,
        avatarUrl,
        publicProfileUrl: publicProfileUrl ?? null,
        levelLabel: state.sidebarLevel.label,
        levelSubtitle: state.sidebarLevel.subtitle,
        levelProgressPct: state.sidebarLevel.progressPct,
        levelProgressText: state.sidebarLevel.progressText,
      }}
    >
      <div className="p-10 max-w-3xl mx-auto w-full pb-24 space-y-8">
        <section className="glass p-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10">
          <h2 className="text-white font-[Outfit] text-lg mb-2">Welcome to your profile</h2>
          <p className="text-sm text-gray-300">
            Complete your profile first, then publish when you are ready. Your public site does not go live until you choose to publish.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={privatePreviewUrl}
              className="btn btn-secondary text-xs px-4 py-2"
              data-analytics-event="public_profile_preview_clicked"
              data-analytics-location="profile_nux"
              data-analytics-destination={privatePreviewUrl}
            >
              <i className="fa-solid fa-eye mr-1"></i> Preview Private Page
            </a>
            <button
              type="button"
              data-profile-publish="1"
              className="btn btn-primary text-xs px-4 py-2"
            >
              <i className="fa-solid fa-rocket mr-1"></i> Publish Public Profile
            </button>
            {publicProfileUrl ? (
              <a
                href={publicProfileUrl}
                className="btn btn-secondary text-xs px-4 py-2"
                data-analytics-event="public_profile_clicked"
                data-analytics-location="profile_nux"
                data-analytics-destination={publicProfileUrl}
              >
                <i className="fa-solid fa-globe mr-1"></i> Open Live Profile
              </a>
            ) : null}
          </div>
        </section>
        <div className="glass p-8 w-full rounded-2xl">
          <h2 className="text-white font-[Outfit] text-lg mb-6 border-b border-white/10 pb-2">Basic Information</h2>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mb-8">
            <button type="button" data-avatar-trigger="1" className="relative group cursor-pointer inline-block bg-transparent border-0 p-0">
              <img src={avatarUrl} className="w-24 h-24 rounded-full object-cover border-4 border-black box-content shadow-[0_0_20px_rgba(79,70,229,0.3)]" alt={displayName} />
              <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition border-4 border-emerald-500">
                <i className="fa-solid fa-camera text-xl text-white"></i>
              </div>
            </button>
            <div>
              <h3 className="text-white text-lg font-medium">{displayName}</h3>
              <p className="text-sm text-gray-400 text-emerald-400 mb-2">{displayEmail}</p>
              <button type="button" data-avatar-trigger="1" className="btn btn-secondary text-xs px-3 py-1.5 rounded">Change Avatar</button>
            </div>
          </div>

          <form className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                  defaultValue={displayName}
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Current Role</label>
                <input
                  type="text"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                  defaultValue={displayHeadline}
                  placeholder="Current role"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Public Bio</label>
              <textarea
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition resize-none custom-scrollbar"
                rows={4}
                defaultValue={displayBio}
                placeholder="Public bio"
              ></textarea>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">LinkedIn URL</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="fa-brands fa-linkedin text-gray-500"></i>
                </div>
                <input
                  type="text"
                  className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                  defaultValue={linkedInUrl}
                  placeholder="https://linkedin.com/in/..."
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Avatar URL</label>
              <input
                id="profile-avatar-url"
                type="url"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                defaultValue={avatarUrl.startsWith("/assets/") ? "" : avatarUrl}
                placeholder="https://..."
              />
            </div>
            <div className="pt-4 mt-4 border-t border-white/10 flex justify-end">
              <button type="button" className="btn btn-primary w-full sm:w-auto px-6 py-2">Save Changes</button>
            </div>
          </form>
        </div>
      </div>
    </DashboardShell>
  );
}
