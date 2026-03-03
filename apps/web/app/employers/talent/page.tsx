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
      <aside className="dash-sidebar">
        <Link href="/employers" className="dash-brand">
          <span className="dash-brand-mark" style={{ background: "linear-gradient(145deg, var(--brand-2), var(--brand))" }}>CG</span>
          <span>CareerGuard Recruiter</span>
        </Link>

        <form className="dash-panel" style={{ padding: 12 }}>
          <h3>Search Talent</h3>
          <input className="input" name="q" placeholder="Search by role, tool, or name" defaultValue={query.q ?? ""} />

          <label htmlFor="role" style={{ marginTop: 10, display: "block" }}>
            Role
          </label>
          <select id="role" className="input" name="role" defaultValue={query.role ?? ""}>
            <option value="">All roles</option>
            {facets.roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>

          <label htmlFor="tool" style={{ marginTop: 10, display: "block" }}>
            Tool
          </label>
          <select id="tool" className="input" name="tool" defaultValue={query.tool ?? ""}>
            <option value="">All tools</option>
            {facets.tools.map((tool) => (
              <option key={tool} value={tool}>
                {tool}
              </option>
            ))}
          </select>

          <label htmlFor="status" style={{ marginTop: 10, display: "block" }}>
            Verification status
          </label>
          <select id="status" className="input" name="status" defaultValue={query.status ?? ""}>
            <option value="">All statuses</option>
            <option value="not_started">not_started</option>
            <option value="in_progress">in_progress</option>
            <option value="built">built</option>
            <option value="verified">verified</option>
          </select>

          <label htmlFor="skill" style={{ marginTop: 10, display: "block" }}>
            Skill/module
          </label>
          <select id="skill" className="input" name="skill" defaultValue={query.skill ?? ""}>
            <option value="">All modules/skills</option>
            {facets.modules.map((module) => (
              <option key={module} value={module}>
                {module}
              </option>
            ))}
          </select>

          <button type="submit" className="btn primary" style={{ marginTop: 10, width: "100%" }}>
            Apply Filters
          </button>
        </form>
      </aside>

      <main className="dash-main">
        <section className="dash-header">
          <div>
            <h1 style={{ fontSize: "2rem" }}>Talent Marketplace</h1>
            <p>{rows.length} candidates match current filters.</p>
          </div>
          <div className="dash-header-actions">
            <Link className="btn" href="/employers">
              Back to Employers
            </Link>
          </div>
        </section>

        <section className="dash-body">
          <article className="dash-panel">
            <h2>20 fake users for employer testing</h2>
            <p className="lead">Use this seeded talent board while testing end-to-end learner onboarding.</p>

            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Type</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Top skills</th>
                    <th>Tools</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.handle}>
                      <td>
                        <Link href={`/employers/talent/${row.handle}`}>{row.name}</Link>
                      </td>
                      <td>{row.careerType}</td>
                      <td>{row.role}</td>
                      <td>{row.status}</td>
                      <td>{row.topSkills.join(", ")}</td>
                      <td>{row.topTools.join(", ")}</td>
                      <td>{row.evidenceScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <div className="result-grid">
            {rows.slice(0, 6).map((row) => (
              <article key={`card-${row.handle}`} className="dash-panel talent-card">
                <h3>{row.name}</h3>
                <p className="lead">{row.role}</p>
                <div className="talent-meta">
                  <span className="tag ok">{row.status}</span>
                  <span className="tag">{row.careerType}</span>
                  <span className="tag">Evidence {row.evidenceScore}</span>
                </div>
                <p><strong>Skills:</strong> {row.topSkills.join(", ")}</p>
                <p><strong>Tools:</strong> {row.topTools.join(", ")}</p>
                <div>
                  <Link className="btn" href={`/employers/talent/${row.handle}`}>
                    Open Recruiter View
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
