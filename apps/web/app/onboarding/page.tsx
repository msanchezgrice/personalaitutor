import { CAREER_PATHS } from "@aitutor/shared";
import { TopNav } from "@/components/nav";
import { OnboardingWizard } from "@/components/onboarding-wizard";

export default function OnboardingPage() {
  return (
    <>
      <TopNav />
      <main className="container section">
        <h1>Onboarding Wizard</h1>
        <p className="lead">
          Tell us your situation, import career context, complete assessment, and get a matrix-driven dashboard.
        </p>

        <OnboardingWizard />

        <section className="panel" style={{ marginTop: 16 }}>
          <h3>Matrix-driven role tracks</h3>
          <div className="grid-3" style={{ marginTop: 10 }}>
            {CAREER_PATHS.map((path) => (
              <article key={path.id} className="card">
                <strong>{path.name}</strong>
                <p className="lead">{path.coreSkillDomain}</p>
                <p><strong>Tools:</strong> {path.tools.join(", ")}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
