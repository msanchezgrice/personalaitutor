export type CareerToolMode = "map" | "resume" | "reset" | "proof" | "gaming";

// Editorial prompts, not an occupation database or a qualification assessment.
export const careerDirections = [
  {
    id: "quality", title: "Software quality and AI output evaluation", capability: "Testing and documenting failures",
    pattern: /\b(test(?:ed|ing)?|reproduc(?:e|ed|ing)|triag(?:e|ed|ing)|debug(?:ged|ging)?|bug(?:s)?)\b/i,
    gaps: ["Test design and coverage", "A repeatable evaluation workflow", "Current role requirements and technical prerequisites"],
    project: "Build a checker for ten synthetic customer replies. Define expected behavior, record failures, and explain when a person must review a result.",
    check: "Include normal, ambiguous, and unsafe cases. Manually compare each result with your written rule; record false positives and misses.",
  },
  {
    id: "design", title: "Product design and prototyping", capability: "Visual communication and iterative design",
    pattern: /\b(design(?:ed|ing)?|prototyp(?:e|ed|ing)|wirefram(?:e|ed|ing)|illustrat(?:e|ed|ing)|layout(?:s)?)\b/i,
    gaps: ["User research and accessibility", "A tested interactive prototype", "Current design-role expectations"],
    project: "Prototype a small form that helps a user check an AI-generated draft before using it. Use fictional content and explain your design choices.",
    check: "Walk through the normal flow, an empty answer, a mistaken answer, and keyboard-only use. Record issues and revisions.",
  },
  {
    id: "marketing", title: "Content and marketing operations", capability: "Content planning and audience communication",
    pattern: /\b(wrote|writ(?:e|ing)|edit(?:ed|ing)?|campaign(?:s)?|copywrit(?:e|ing)|brief(?:ed|ing|s)?)\b/i,
    gaps: ["Audience and channel measurement", "A documented review workflow", "Permission to use source material"],
    project: "Create a brief-to-draft workflow for a fictional product. Keep the brief, prompt, first draft, fact checks, and edited version.",
    check: "Check each claim against the fictional brief, inspect tone and accessibility, and explain the edits you made.",
  },
  {
    id: "product", title: "Product and delivery operations", capability: "Prioritizing work and coordinating decisions",
    pattern: /\b(prioriti[sz](?:e|ed|ing)|roadmap(?:s)?|coordinat(?:e|ed|ing)|specif(?:y|ied|ication)|backlog(?:s)?|handoff(?:s)?)\b/i,
    gaps: ["Customer discovery and problem selection", "A working prototype or decision artifact", "Evidence of tradeoffs and stakeholder communication"],
    project: "Turn a synthetic feedback set into a prioritized problem list, one small specification, and a prototype or walkthrough.",
    check: "Trace each priority to an input, list assumptions and tradeoffs, and check the prototype against its acceptance criteria.",
  },
  {
    id: "analytics", title: "Analytics and reporting workflows", capability: "Interpreting data and checking conclusions",
    pattern: /\b(analy[sz](?:e|ed|ing)|report(?:ed|ing|s)?|dashboard(?:s)?|sql|spreadsheet(?:s)?|forecast(?:ed|ing)?)\b/i,
    gaps: ["Data quality and reproducibility", "Relevant SQL or analysis requirements", "A checked report with defensible conclusions"],
    project: "Use a small synthetic dataset to create a reproducible report. Let an AI assistant draft an explanation, then check every number yourself.",
    check: "Reconcile totals, test missing values, record assumptions, and separate observations from causal claims.",
  },
  {
    id: "support", title: "Customer support and knowledge operations", capability: "Resolving questions and documenting processes",
    pattern: /\b(support(?:ed|ing)?|resolv(?:e|ed|ing)|ticket(?:s)?|knowledge base|document(?:ed|ing)?|onboard(?:ed|ing)?)\b/i,
    gaps: ["Escalation rules and data handling", "A maintained knowledge workflow", "Current customer-facing requirements"],
    project: "Build a short FAQ and escalation guide from fictional support questions. Compare AI drafts with the source answers.",
    check: "Test an answerable question, missing information, and a sensitive request. Verify that unsupported answers are escalated.",
  },
] as const;

export function mapExperience(text: string) {
  const clauses = text.slice(0, 3000).split(/[\n.!?;]+|\bbut\b/i).map((line) => line.trim()).filter(Boolean);
  // Conservative: skip a whole negated clause rather than infer experience it denies.
  const affirmed = clauses.filter((line) => !/\b(no|not|never|without|cannot|can't|haven't|hasn't|don't|didn't|isn't|unable|want to|plan to|hope to|wish to|learning to)\b/i.test(line));
  return careerDirections.flatMap((direction) => {
    const evidence = affirmed.filter((line) => direction.pattern.test(line));
    return evidence.length ? [{ id: direction.id, title: direction.title, capability: direction.capability, evidence, gaps: [...direction.gaps] }] : [];
  });
}

export type ResumeEvidenceInput = {
  action: string; output: string; check: string; evidence: string; status: "planned" | "completed";
};

export function buildResumeEvidence(input: ResumeEvidenceInput): string {
  const action = input.action.trim().slice(0, 1500);
  const output = input.output.trim().slice(0, 1500);
  const check = input.check.trim().slice(0, 1500);
  if (!action || !output || !check) return "";
  const planned = input.status === "planned";
  return [
    planned ? "Planned project — Do not present this as completed work." : "Independent project (self-reported) — review for accuracy before using.",
    `Work: ${action}`, `Output: ${output}`, `Quality check${planned ? " to complete" : " (as reported)"}: ${check}`,
    `Evidence: ${input.evidence.trim().slice(0, 1500) || "Not supplied — add an inspectable artifact before making a proof claim."}`,
    "Resume draft:",
    planned ? `Planned project: ${action}. Intended output: ${output}. Planned validation: ${check}.` : `${action}. Produced ${output}. Checked the work through ${check}.`,
    "Keep this under Projects if it was independent work. Preserve historical job titles. Add numbers only when you have a measurement that supports them.",
  ].join("\n\n");
}

export function buildCareerPlan(directionId: string, hours: string, mode: "proof" | "reset"): string {
  const direction = careerDirections.find((entry) => entry.id === directionId);
  if (!direction) return "";
  const time = ["2", "5", "10"].includes(hours) ? hours : "2";
  return [
    `${mode === "reset" ? "Career reset" : "Proof project"} plan: ${direction.title}`,
    `Time budget: ${time} hours per week. This is a starting plan, not a skill verification or a hiring prediction. Reduce the scope if it does not fit your week.`,
    ...(mode === "reset" ? [
      "Next 48 hours: list the tasks that changed, the tasks you can still do well, and your practical constraints. Keep an income search running alongside learning if needed.",
      "This week: compare two current job descriptions from actual employers. List recurring tasks, prerequisites, location, and work authorization requirements. Ask one trusted former colleague which of your tasks they can describe accurately.",
    ] : ["Before building: compare two current job descriptions. Choose one repeated task to investigate; confirm that the project below is relevant before spending time on it."]),
    `Small project: ${direction.project}`,
    `Completion checks: ${direction.check}`,
    `Still to investigate: ${direction.gaps.join("; ")}.`,
    "Evidence package: save the brief, inputs you have permission to share, prompts or steps, output, test results, mistakes, and revisions. Label synthetic data and self-review clearly.",
    "Next review: ask someone familiar with the target work to inspect the artifact. Revise your direction or learning plan based on that feedback. A draft plan does not show that you completed the work.",
  ].join("\n\n");
}
