import { CAREER_PATHS } from "@aitutor/shared";
import { TopNav } from "@/components/nav";
import { OnboardingWizard } from "@/components/onboarding-wizard";

export default function OnboardingPage() {
  return (
    <>
      <TopNav />
      <main className="section">
        <div className="container grid-2" style={{ alignItems: "start" }}>
          <section className="panel pad">
            <span className="tag">Your AI-native career starts here</span>
            <h1 style={{ marginTop: 14, fontSize: "3rem" }}>
              Onboarding Wizard
            </h1>
            <p className="lead">
              Tell us your situation, import your career context, complete the AI baseline quiz, and generate your
              custom dashboard.
            </p>
            <ul className="list">
              <li>LinkedIn OAuth starter included for MVP.</li>
              <li>Resume upload field maps to importer endpoint.</li>
              <li>No silent fallback: every blocked step shows explicit recovery action.</li>
            </ul>
          </section>

          <section className="panel pad">
            <OnboardingWizard />
          </section>
        </div>

        <section className="container panel pad" style={{ marginTop: 16 }}>
          <h3>Matrix-driven role tracks</h3>
          <div className="grid-3" style={{ marginTop: 10 }}>
            {CAREER_PATHS.map((path) => (
              <article key={path.id} className="card">
                <strong>{path.name}</strong>
                <p>{path.coreSkillDomain}</p>
                <p><strong>Tools:</strong> {path.tools.join(", ")}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
