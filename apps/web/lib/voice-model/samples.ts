import { VOICE_MODEL_MAX_SAMPLES, VOICE_MODEL_SAMPLE_MAX_CHARS } from "@aitutor/shared";

/**
 * Splitting and validating pasted writing samples. Pure (no server-only) so
 * the dashboard can show the same count the server will store.
 *
 * Learners paste one sample, or many separated by a line that holds only
 * `---` (three or more dashes, surrounding spaces allowed).
 */

/** Below this a piece of writing shows too little of a voice to be useful. */
export const VOICE_MODEL_SAMPLE_MIN_CHARS = 40;

const SEPARATOR_LINE = /^[ \t]*-{3,}[ \t]*$/;

export function splitVoiceSamples(text: string): string[] {
  const pieces: string[] = [];
  let current: string[] = [];
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (SEPARATOR_LINE.test(line)) {
      pieces.push(current.join("\n"));
      current = [];
    } else {
      current.push(line);
    }
  }
  pieces.push(current.join("\n"));
  return pieces.map((piece) => piece.trim()).filter((piece) => piece.length > 0);
}

export type VoiceSampleBatchResult =
  | { ok: true; samples: Array<{ title: string | null; content: string }> }
  | {
      ok: false;
      code: "VOICE_MODEL_SAMPLES_EMPTY" | "VOICE_MODEL_SAMPLE_TOO_SHORT" | "VOICE_MODEL_SAMPLE_TOO_LONG" | "VOICE_MODEL_SAMPLE_LIMIT";
      message: string;
      /** 1-based position of the offending sample in the paste, when there is one. */
      sampleNumber?: number;
    };

/**
 * Splits `text` and checks it against the shared limits, given how many
 * samples the model already has. All or nothing: one bad piece rejects the
 * batch, with a sentence that says which one.
 */
export function prepareVoiceSampleBatch(input: { text: string; title?: string | null; existingCount: number }): VoiceSampleBatchResult {
  const pieces = splitVoiceSamples(input.text);
  if (pieces.length === 0) {
    return { ok: false, code: "VOICE_MODEL_SAMPLES_EMPTY", message: "Paste at least one piece of your writing." };
  }
  const room = Math.max(0, VOICE_MODEL_MAX_SAMPLES - input.existingCount);
  if (pieces.length > room) {
    return {
      ok: false,
      code: "VOICE_MODEL_SAMPLE_LIMIT",
      message:
        room === 0
          ? `This model already has the maximum of ${VOICE_MODEL_MAX_SAMPLES} samples. Remove one to add another.`
          : `You can add ${room} more ${room === 1 ? "sample" : "samples"} (the limit is ${VOICE_MODEL_MAX_SAMPLES}). This paste has ${pieces.length}.`,
    };
  }
  for (const [index, piece] of pieces.entries()) {
    const label = pieces.length === 1 ? "This sample" : `Sample ${index + 1}`;
    if (piece.length < VOICE_MODEL_SAMPLE_MIN_CHARS) {
      return {
        ok: false,
        code: "VOICE_MODEL_SAMPLE_TOO_SHORT",
        message: `${label} is too short to show your voice. Use at least ${VOICE_MODEL_SAMPLE_MIN_CHARS} characters.`,
        sampleNumber: index + 1,
      };
    }
    if (piece.length > VOICE_MODEL_SAMPLE_MAX_CHARS) {
      return {
        ok: false,
        code: "VOICE_MODEL_SAMPLE_TOO_LONG",
        message: `${label} is ${piece.length.toLocaleString("en-US")} characters. Keep each sample under ${VOICE_MODEL_SAMPLE_MAX_CHARS.toLocaleString("en-US")}, or split it with a line of ---.`,
        sampleNumber: index + 1,
      };
    }
  }
  const title = pieces.length === 1 ? input.title?.trim().slice(0, 120) || null : null;
  return { ok: true, samples: pieces.map((content) => ({ title, content })) };
}

/** First line of a sample, shortened, for lists. */
export function voiceSamplePreview(content: string, max = 90): string {
  const firstLine = content.split("\n").find((line) => line.trim().length > 0)?.trim() ?? "";
  return firstLine.length > max ? `${firstLine.slice(0, max - 1).trimEnd()}…` : firstLine;
}
