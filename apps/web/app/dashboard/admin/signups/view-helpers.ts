type AssessmentAnswer = {
  questionId: string;
  value: number;
};

const ASSESSMENT_QUESTION_LABELS: Record<string, string> = {
  career_experience: "Career experience",
  ai_comfort: "AI comfort",
  daily_work_complexity: "Workflow complexity",
  linkedin_context: "LinkedIn signal",
  resume_context: "Resume signal",
};

const ASSESSMENT_ANSWER_LABELS: Record<string, Record<number, string>> = {
  career_experience: {
    1: "Just starting",
    2: "Early experience",
    3: "Working experience",
    4: "Strong experience",
    5: "Deep experience",
  },
  ai_comfort: {
    1: "Very low comfort",
    2: "Low comfort",
    3: "Moderate comfort",
    4: "High comfort",
    5: "Very high comfort",
  },
  daily_work_complexity: {
    1: "Simple workflow",
    2: "Some complexity",
    3: "Moderate complexity",
    4: "High complexity",
    5: "Very high complexity",
  },
  linkedin_context: {
    1: "No LinkedIn signal",
    2: "Limited LinkedIn signal",
    3: "Some LinkedIn signal",
    4: "Strong LinkedIn signal",
    5: "Full LinkedIn signal",
  },
  resume_context: {
    1: "No resume signal",
    2: "Limited resume signal",
    3: "Some resume signal",
    4: "Strong resume signal",
    5: "Full resume signal",
  },
};

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function stringifyJson(value: unknown) {
  if (!value) return null;
  return JSON.stringify(value, null, 2);
}

export function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((entry) => stringValue(entry)).filter((entry): entry is string => Boolean(entry))
    : [];
}

export function safeExternalUrl(value: string | null | undefined) {
  const normalized = stringValue(value);
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `https://${normalized}`;
}

function clampAssessmentScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(1, Math.min(5, Math.round(value)));
}

function assessmentQuestionLabel(questionId: string) {
  return ASSESSMENT_QUESTION_LABELS[questionId] ?? questionId.replace(/[_-]+/g, " ");
}

function assessmentAnswerLabel(questionId: string, value: number) {
  const score = clampAssessmentScore(value);
  return ASSESSMENT_ANSWER_LABELS[questionId]?.[score] ?? `${score}/5`;
}

export function assessmentAnswerEntries(answers: AssessmentAnswer[] | null | undefined) {
  return (answers ?? [])
    .filter(
      (entry): entry is AssessmentAnswer =>
        Boolean(entry) &&
        typeof entry.questionId === "string" &&
        Number.isFinite(Number(entry.value)),
    )
    .map((entry) => {
      const score = clampAssessmentScore(Number(entry.value));
      return {
        questionId: entry.questionId,
        question: assessmentQuestionLabel(entry.questionId),
        score,
        scoreLabel: `${score}/5`,
        answer: assessmentAnswerLabel(entry.questionId, score),
      };
    });
}

function posthogDirectPersonUrl(uuid: string) {
  const projectId = process.env.POSTHOG_PROJECT_ID?.trim() || process.env.POSTHOG_CLI_PROJECT_ID?.trim() || "330799";
  return `https://us.posthog.com/project/${encodeURIComponent(projectId)}/persons/${encodeURIComponent(uuid)}`;
}

function posthogAuthHeaders(): Record<string, string> | null {
  const apiKey = process.env.POSTHOG_API_KEY?.trim() || process.env.POSTHOG_CLI_API_KEY?.trim() || "";
  if (apiKey) {
    return {
      Authorization: `Bearer ${apiKey}`,
    } satisfies Record<string, string>;
  }

  const sessionId = process.env.POSTHOG_SESSION_ID?.trim() || "";
  const csrfToken = process.env.POSTHOG_CSRF_TOKEN?.trim() || "";
  if (sessionId && csrfToken) {
    const projectId = process.env.POSTHOG_PROJECT_ID?.trim() || process.env.POSTHOG_CLI_PROJECT_ID?.trim() || "330799";
    const host = (process.env.POSTHOG_HOST?.trim() || "https://us.posthog.com").replace(/\/+$/, "");
    return {
      Cookie: `sessionid=${sessionId}; posthog_csrftoken=${csrfToken}`,
      "X-CSRFToken": csrfToken,
      Referer: `${host}/project/${projectId}/`,
    } satisfies Record<string, string>;
  }

  return null;
}

export async function resolvePosthogPersonUrls(distinctIds: Array<string | null | undefined>) {
  const headers = posthogAuthHeaders();
  const resolved = new Map<string, string>();
  if (!headers) return resolved;

  const host = (process.env.POSTHOG_HOST?.trim() || "https://us.posthog.com").replace(/\/+$/, "");
  const projectId = process.env.POSTHOG_PROJECT_ID?.trim() || process.env.POSTHOG_CLI_PROJECT_ID?.trim() || "330799";
  const uniqueIds = Array.from(
    new Set(
      distinctIds
        .map((entry) => stringValue(entry))
        .filter((entry): entry is string => Boolean(entry)),
    ),
  );

  await Promise.all(
    uniqueIds.map(async (distinctId) => {
      try {
        const response = await fetch(
          `${host}/api/projects/${encodeURIComponent(projectId)}/persons/?limit=1&search=${encodeURIComponent(distinctId)}`,
          {
            headers,
            cache: "no-store",
          },
        );
        if (!response.ok) return;
        const payload = (await response.json()) as {
          results?: Array<{ uuid?: string | null; id?: string | null }>;
        };
        const person = payload.results?.[0];
        const uuid = stringValue(person?.uuid) || stringValue(person?.id);
        if (!uuid) return;
        resolved.set(distinctId, posthogDirectPersonUrl(uuid));
      } catch {
        return;
      }
    }),
  );

  return resolved;
}

export function isMetaSource(value: string | null | undefined) {
  const normalized = stringValue(value)?.toLowerCase() || "";
  return normalized === "fb" || normalized === "ig" || normalized === "an" || normalized.includes("facebook") || normalized.includes("instagram") || normalized.includes("meta");
}

function metaAuthToken() {
  return process.env.META_ADS_ACCESS_TOKEN?.trim() || process.env.META_CONVERSIONS_ACCESS_TOKEN?.trim() || "";
}

export async function resolveMetaCampaignNames(campaignIds: Array<string | null | undefined>) {
  const token = metaAuthToken();
  const resolved = new Map<string, string>();
  if (!token) return resolved;

  const uniqueIds = Array.from(
    new Set(
      campaignIds
        .map((entry) => stringValue(entry))
        .filter((entry): entry is string => Boolean(entry))
        .filter((entry) => /^\d{6,}$/.test(entry)),
    ),
  );

  await Promise.all(
    uniqueIds.map(async (campaignId) => {
      try {
        const response = await fetch(
          `https://graph.facebook.com/v19.0/${encodeURIComponent(campaignId)}?fields=id,name&access_token=${encodeURIComponent(token)}`,
          {
            cache: "no-store",
          },
        );
        if (!response.ok) return;
        const payload = (await response.json()) as { name?: string | null };
        const name = stringValue(payload.name);
        if (!name) return;
        resolved.set(campaignId, name);
      } catch {
        return;
      }
    }),
  );

  return resolved;
}
