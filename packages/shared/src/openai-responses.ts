/**
 * Shared OpenAI Responses API plumbing. Originally extracted from
 * `apps/web/lib/runtime.ts` (`generateTutorReply` pattern) into
 * `apps/web/lib/openai-responses.ts`; moved here so the worker
 * (`apps/worker`) can run the exact same client for artifact content
 * generation. The web module re-exports this file behind a `server-only`
 * guard — new LLM features must use this client, never bespoke fetch code.
 *
 * Failure contract (no silent fallbacks):
 * - `OPENAI_API_KEY_MISSING` when the key is absent.
 * - `OPENAI_RESPONSE_FAILED:<status>:<detail>` on HTTP errors.
 * - `OPENAI_EMPTY_RESPONSE` when no output text is returned.
 */

export type OpenAiResponsesPayload = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
};

export function resolveOpenAiModel() {
  return process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
}

export function extractOpenAiOutputText(data: OpenAiResponsesPayload) {
  const fromOutputText = typeof data.output_text === "string" ? data.output_text.trim() : "";
  if (fromOutputText) return fromOutputText;
  const firstText = data.output
    ?.flatMap((entry) => entry.content ?? [])
    .find((entry) => entry.type === "output_text" || entry.type === "text")?.text;
  return firstText?.trim() || "";
}

export async function callOpenAiResponses(input: {
  prompt: string;
  temperature?: number;
  model?: string;
  textFormat?: { type: string } & Record<string, unknown>;
  maxOutputTokens?: number;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_MISSING");
  }

  const model = input.model ?? resolveOpenAiModel();

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: input.prompt,
      temperature: input.temperature ?? 0.2,
      ...(input.textFormat ? { text: { format: input.textFormat } } : {}),
      ...(input.maxOutputTokens ? { max_output_tokens: input.maxOutputTokens } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OPENAI_RESPONSE_FAILED:${response.status}:${detail.slice(0, 200)}`);
  }

  const data = (await response.json()) as OpenAiResponsesPayload;
  const text = extractOpenAiOutputText(data);
  if (!text) {
    throw new Error("OPENAI_EMPTY_RESPONSE");
  }
  return text;
}
