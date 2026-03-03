import Link from "next/link";
import { getEmployerFacets, runtimeListTalent } from "@/lib/runtime";

type TalentSearchPageProps = {
  searchParams: Promise<{
    role?: string;
    skill?: string;
    tool?: string;
    status?: "not_started" | "in_progress" | "built" | "verified";
    q?: string;
  }>;
};

export default async function TalentPage({ searchParams }: TalentSearchPageProps) {
  const query = await searchParams;
  const facets = getEmployerFacets();
  const rows = await runtimeListTalent({
    role: query.role,
    skill: query.skill,
    tool: query.tool,
    status: query.status,
    q: query.q,
  });

  return (
    <div className="dash-app">
      <aside className="dash-sidebar" style={{ background: "rgba(0,0,0,.38)" }}>
        <Link href="/employers" className="dash-brand">
          <span className="dash-brand-mark" style={{ background: "#10b981", color: "#0f111a", boxShadow: "none" }}>CG</span>
          <span>CareerGuard Recruiter</span>
        </Link>

        <section className="dash-panel" style={{ padding: 14 }}>
          <h3>Filter by Skill</h3>
          <form style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" defaultChecked />Python Scripting</label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" defaultChecked />API Integrations</label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" />Cursor IDE</label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" />RAG Architecture</label>
            <hr style={{ borderColor: "var(--line)", width: "100%" }} />
            <label htmlFor="role">Role</label>
            <select id="role" className="input" name="role" defaultValue={query.role ?? ""}>
              <option value="">All roles</option>
              {facets.roles.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            <label htmlFor="tool">Tool</label>
            <select id="tool" className="input" name="tool" defaultValue={query.tool ?? ""}>
              <option value="">All tools</option>
              {facets.tools.map((tool) => (
                <option key={tool} value={tool}>{tool}</option>
              ))}
            </select>
            <label htmlFor="status">Verification level</label>
            <select id="status" className="input" name="status" defaultValue={query.status ?? ""}>
              <option value="">System Verified Only</option>
              <option value="verified">verified</option>
              <option value="built">built</option>
              <option value="in_progress">in_progress</option>
              <option value="not_started">not_started</option>
            </select>
            <label htmlFor="skill">Module</label>
            <select id="skill" className="input" name="skill" defaultValue={query.skill ?? ""}>
              <option value="">All modules</option>
              {facets.modules.map((module) => (
                <option key={module} value={module}>{module}</option>
              ))}
            </select>
            <input className="input" name="q" placeholder="Search by role, name, or tool" defaultValue={query.q ?? ""} />
            <button type="submit" className="btn primary">Apply Filters</button>
          </form>
        </section>
      </aside>

      <main className="dash-main">
        <section className="dash-header">
          <div>
            <h1 style={{ fontSize: "2rem" }}>{rows.length} Candidates Match Criteria</h1>
            <p>Matrix-driven search facets and upwork-style skills/tool summaries.</p>
          </div>
          <div className="dash-header-actions">
            <Link href="/employers" className="btn">Back to Employers</Link>
          </div>
        </section>

        <section className="dash-body">
          <div className="grid-3">
            {rows.slice(0, 20).map((row) => (
              <article key={row.handle} className="dash-panel talent-card" style={{ borderColor: "rgba(16,185,129,.2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <img src="/assets/avatar.png" alt={row.name} style={{ width: 56, height: 56, borderRadius: 999, border: "1px solid var(--line)" }} />
                  <span className="tag ok">Verified</span>
                </div>
                <h3 style={{ marginTop: 8 }}>{row.name}</h3>
                <p className="lead" style={{ marginTop: 0 }}>{row.role}</p>
                <div style={{ marginTop: 8, display: "grid", gap: 4, fontSize: ".85rem", color: "var(--text-muted)" }}>
                  <span>{row.evidenceScore} evidence score</span>
                  <span>{row.topSkills.join(", ")}</span>
                  <span>{row.topTools.join(", ")}</span>
                </div>
                <div className="talent-meta" style={{ marginTop: 10 }}>
                  {row.topSkills.slice(0, 2).map((skill) => (
                    <span className="tag" key={`${row.handle}-${skill}`}>{skill}</span>
                  ))}
                </div>
                <Link href={`/employers/talent/${row.handle}`} className="btn" style={{ marginTop: 10 }}>Open Profile</Link>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
