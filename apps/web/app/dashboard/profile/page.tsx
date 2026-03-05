import { DashboardShell } from "@/components/dashboard-runtime-shell";

export default function DashboardProfilePage() {
  return (
    <DashboardShell
      activeTab="profile"
      headerTitle={(
        <span className="flex items-center gap-3">
          <i className="fa-solid fa-user text-emerald-400"></i> Profile Settings
        </span>
      )}
      headerActions={(
        <a href="/u/alex-chen-ai/" className="btn btn-primary text-xs px-4 py-2">
          <i className="fa-solid fa-globe mr-1"></i> View Public Profile
        </a>
      )}
    >
      <div className="p-10 max-w-3xl mx-auto w-full pb-24 space-y-8">
        <div className="glass p-8 w-full rounded-2xl">
          <h2 className="text-white font-[Outfit] text-lg mb-6 border-b border-white/10 pb-2">Basic Information</h2>

          <div className="flex items-center gap-6 mb-8">
            <div className="relative group cursor-pointer inline-block">
              <img src="/assets/avatar.png" className="w-24 h-24 rounded-full object-cover border-4 border-black box-content shadow-[0_0_20px_rgba(79,70,229,0.3)]" alt="Profile avatar" />
              <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition border-4 border-emerald-500">
                <i className="fa-solid fa-camera text-xl text-white"></i>
              </div>
            </div>
            <div>
              <h3 className="text-white text-lg font-medium">Loading learner profile...</h3>
              <p className="text-sm text-gray-400 text-emerald-400 mb-2">loading@example.com</p>
              <button className="btn btn-secondary text-xs px-3 py-1.5 rounded">Change Avatar</button>
            </div>
          </div>

          <form className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                  defaultValue=""
                  placeholder="Loading name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Current Role</label>
                <input
                  type="text"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                  defaultValue=""
                  placeholder="Loading role"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Public Bio</label>
              <textarea
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition resize-none custom-scrollbar"
                rows={4}
                defaultValue=""
                placeholder="Loading profile bio"
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
                  defaultValue=""
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
                defaultValue=""
                placeholder="https://..."
              />
            </div>
            <div className="pt-4 mt-4 border-t border-white/10 flex justify-end">
              <button type="button" className="btn btn-primary px-6 py-2">Save Changes</button>
            </div>
          </form>
        </div>
      </div>
    </DashboardShell>
  );
}
