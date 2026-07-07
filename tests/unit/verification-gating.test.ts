import { describe, expect, test } from "vitest";
import {
  artifactCountsAsBuiltEvidence,
  canMarkProjectBuilt,
  canMarkSkillVerified,
  type ProjectArtifact,
} from "@aitutor/shared";

const now = new Date().toISOString();

function artifact(partial: Partial<ProjectArtifact> & { kind: string; url: string }): ProjectArtifact {
  return { createdAt: now, metadata: {}, ...partial };
}

describe("built-state gating", () => {
  test("a generated artifact with persisted content counts as built evidence", () => {
    const generated = artifact({
      kind: "website",
      url: "/generated/p/website-1.html",
      metadata: { source: "generated_artifact", contentId: "content-123" },
    });
    expect(artifactCountsAsBuiltEvidence(generated)).toBe(true);
    expect(canMarkProjectBuilt([generated])).toBe(true);
  });

  test("legacy placeholder artifacts (no persisted content) do NOT count", () => {
    const legacy = artifact({
      kind: "website",
      url: "/generated/p/website-0.html",
      metadata: { source: "generated_artifact", generator: "website" },
    });
    const bare = artifact({ kind: "pdf", url: "/generated/p/pdf-0.pdf" });
    expect(artifactCountsAsBuiltEvidence(legacy)).toBe(false);
    expect(artifactCountsAsBuiltEvidence(bare)).toBe(false);
    expect(canMarkProjectBuilt([legacy, bare])).toBe(false);
  });

  test("user-submitted proof counts as built evidence", () => {
    const link = artifact({ kind: "proof_link", url: "https://example.com/x" });
    const upload = artifact({ kind: "proof_upload", url: "https://storage/x.png" });
    expect(artifactCountsAsBuiltEvidence(link)).toBe(true);
    expect(artifactCountsAsBuiltEvidence(upload)).toBe(true);
    expect(canMarkProjectBuilt([link])).toBe(true);
    expect(canMarkProjectBuilt([upload])).toBe(true);
  });

  test("no artifacts means not built", () => {
    expect(canMarkProjectBuilt([])).toBe(false);
  });
});

describe("verified-state gating", () => {
  const realArtifact = artifact({
    kind: "website",
    url: "/generated/p/website-1.html",
    metadata: { source: "generated_artifact", contentId: "content-123" },
  });

  test("verified requires BOTH checklist completion and built evidence", () => {
    expect(canMarkSkillVerified({ checklistComplete: true, artifacts: [realArtifact] })).toBe(true);
    expect(canMarkSkillVerified({ checklistComplete: false, artifacts: [realArtifact] })).toBe(false);
    expect(canMarkSkillVerified({ checklistComplete: true, artifacts: [] })).toBe(false);
  });

  test("placeholder artifacts cannot back a verified state", () => {
    const legacy = artifact({ kind: "pptx", url: "/generated/p/pptx-0.pptx", metadata: { source: "generated_artifact" } });
    expect(canMarkSkillVerified({ checklistComplete: true, artifacts: [legacy] })).toBe(false);
  });
});
