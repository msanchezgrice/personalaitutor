import "server-only";

/**
 * Web-side entry point for the shared OpenAI Responses API plumbing.
 *
 * The implementation moved to `@aitutor/shared` (packages/shared/src/
 * openai-responses.ts) so the worker can run the exact same client for
 * artifact content generation. This module keeps the `server-only` guard for
 * Next.js and preserves the existing import path — all web LLM callers keep
 * importing from `@/lib/openai-responses`.
 *
 * Failure contract (no silent fallbacks):
 * - `OPENAI_API_KEY_MISSING` when the key is absent.
 * - `OPENAI_RESPONSE_FAILED:<status>:<detail>` on HTTP errors.
 * - `OPENAI_EMPTY_RESPONSE` when no output text is returned.
 */

export {
  callOpenAiResponses,
  extractOpenAiOutputText,
  resolveOpenAiModel,
  type OpenAiResponsesPayload,
} from "@aitutor/shared";
