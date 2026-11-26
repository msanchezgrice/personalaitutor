/** Display helpers shared by the public section and the dashboard. Pure. */

/** "Nov 18, 2026". Fixed to UTC so server and client render the same text. */
export function formatVoiceModelDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

/** "24 launch emails", "1 launch email" is not attempted: sample types are free text, so only the count changes. */
export function formatVoiceModelSamples(count: number, sampleType: string): string {
  const type = sampleType.trim() || (count === 1 ? "sample" : "samples");
  return `${count} ${type}`;
}

/** Human sentence for a failed run, from the API status and error code. */
export function voiceModelRunErrorMessage(input: { status: number; code?: string | null; message?: string | null }): string {
  const { status, code } = input;
  if (code === "VOICE_MODEL_RATE_LIMITED" || status === 429) {
    return input.message?.trim() || "This model has had a lot of runs lately. Try again later.";
  }
  if (code === "INVALID_BODY" || status === 400) return "Write a task of 3 to 400 characters, then run it again.";
  if (code === "VOICE_MODEL_NOT_FOUND" || status === 404) return "This model is not available right now.";
  if (code === "VOICE_MODEL_NOT_TUNED") return "Tune the model before testing it.";
  if (code === "OPENAI_CONFIG_MISSING") return "The model service is not set up right now. Try again later.";
  if (status === 401) return "Your session ended. Sign in again to continue.";
  if (status === 402) return "Proof Studio needs an active Career Builder plan.";
  return "The model did not answer this time. Try again in a minute.";
}
