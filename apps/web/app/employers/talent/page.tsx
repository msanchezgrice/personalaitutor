import Link from "next/link";
import { getEmployerFacets, runtimeListTalent } from "@/lib/runtime";
import { TopNav } from "@/components/nav";

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
    <>
      <TopNav />
      <main className="container section">
        <h1>Talent Marketplace</h1>
        <p className="lead">Search matrix-driven candidates with proof-backed AI skill evidence.</p>

        <section className="panel" style={{ marginTop: 14 }}>
          <h3>Search and filters</h3>
          <form className="grid-4" style={{ marginTop: 10 }}>
            <input className="input" name="q" placeholder="Search candidates" defaultValue={query.q ?? ""} />

            <select className="input" name="role" defaultValue={query.role ?? ""}>
              <option value="">All roles</option>
              {facets.roles.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>

            <select className="input" name="tool" defaultValue={query.tool ?? ""}>
              <option value="">All tools</option>
              {facets.tools.map((tool) => (
                <option key={tool} value={tool}>{tool}</option>
              ))}
            </select>

            <select className="input" name="status" defaultValue={query.status ?? ""}>
              <option value="">All statuses</option>
              <option value="not_started">not_started</option>
              <option value="in_progress">in_progress</option>
              <option value="built">built</option>
              <option value="verified">verified</option>
            </select>

            <select className="input" name="skill" defaultValue={query.skill ?? ""}>
              <option value="">All modules/skills</option>
              {facets.modules.map((module) => (
                <option key={module} value={module}>{module}</option>
              ))}
            </select>

            <button type="submit" className="btn primary">Apply Filters</button>
          </form>
        </section>

        <section className="panel" style={{ marginTop: 16 }}>
          <h3>20 fake users for employer testing</h3>
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table>
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Type</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Skills</th>
                  <th>Tools</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.handle}>
                    <td><Link href={`/employers/talent/${row.handle}`}>{row.name}</Link></td>
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
          <p className="lead">Results: {rows.length}</p>
        </section>
      </main>
    </>
  );
}
